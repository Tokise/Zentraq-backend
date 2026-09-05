import { Buffer } from "node:buffer";
import { Readable } from "node:stream";

import { google } from "googleapis";
import { z } from "zod";

const REPORT_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

const serviceAccountSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().includes("BEGIN PRIVATE KEY"),
  project_id: z.string().trim().min(1),
});

const integrationSchema = z.object({
  allowedDomain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+$/),
  folderId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
});

export interface GoogleWorkspaceEnvironment {
  GOOGLE_ALLOWED_WORKSPACE_DOMAIN?: string;
  GOOGLE_DRIVE_ENABLED?: string;
  GOOGLE_DRIVE_PRODUCTION_FOLDER_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?: string;
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
}

export interface ReportAnalyticsSnapshot {
  clearances: Array<{
    approved: number;
    evaluating: number;
    pending: number;
    rejected: number;
    requester_type: string;
    total_requests: number;
  }>;
  complaints: Array<{
    complaint: string;
    frequency: number;
  }>;
  daily: Array<{
    appointment_visits: number;
    consultation_date: string;
    faculty_consultations: number;
    rfid_visits: number;
    visitor_consultations?: number
  student_consultations: number;
    total_consultations: number;
  }>;
  dispensing: Array<{
    brand_name: string | null;
    category: string | null;
    first_dispensed: string | null;
    generic_name: string;
    last_dispensed: string | null;
    total_dispensed: number;
    total_quantity_dispensed: number;
  }>;
}

interface GoogleWorkspaceConfig {
  allowedDomain: string;
  credentials: z.infer<typeof serviceAccountSchema>;
  folderId: string;
  spreadsheetId: string;
}

export interface GoogleWorkspacePublisher {
  publishAnalytics(
    snapshot: ReportAnalyticsSnapshot,
    snapshotId: string,
    publishedAt: string,
  ): Promise<void>;
  uploadWorkbook(input: {
    bytes: Uint8Array;
    idempotencyKey: string;
    reportId: string;
  }): Promise<{ fileId: string; webViewLink: string }>;
}

// Reports provider failures without retaining response bodies or credentials.
export class GoogleWorkspaceError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "GoogleWorkspaceError";
  }
}

// Loads and validates all Drive and Sheets settings when integration is enabled.
export function loadGoogleWorkspaceConfig(
  environment: GoogleWorkspaceEnvironment = process.env,
): GoogleWorkspaceConfig | null {
  if (environment.GOOGLE_DRIVE_ENABLED !== "true") return null;

  const encoded = environment.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!encoded) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is required when Google Drive is enabled.",
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is invalid.");
  }

  const credentials = serviceAccountSchema.safeParse(decoded);
  const integration = integrationSchema.safeParse({
    allowedDomain: environment.GOOGLE_ALLOWED_WORKSPACE_DOMAIN,
    folderId: environment.GOOGLE_DRIVE_PRODUCTION_FOLDER_ID,
    spreadsheetId: environment.GOOGLE_SHEETS_SPREADSHEET_ID,
  });
  if (!credentials.success || !integration.success) {
    throw new Error("Google Workspace reporting configuration is invalid.");
  }

  return {
    ...integration.data,
    credentials: credentials.data,
  };
}

// Creates a scoped publisher without domain-wide delegation.
export function createGoogleWorkspacePublisher(
  environment: GoogleWorkspaceEnvironment = process.env,
): GoogleWorkspacePublisher | null {
  const config = loadGoogleWorkspaceConfig(environment);
  if (!config) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: config.credentials,
    scopes: GOOGLE_SCOPES,
  });
  const drive = google.drive({ auth, version: "v3" });
  const sheets = google.sheets({ auth, version: "v4" });

  return {
    // Publishes fixed aggregate columns and commits metadata last.
    async publishAnalytics(snapshot, snapshotId, publishedAt) {
      const spreadsheetId = config.spreadsheetId;
      await retryGoogleOperation(async () => {
        await sheets.spreadsheets.values.batchClear({
          spreadsheetId,
          requestBody: {
            ranges: [
              "daily_consultations!A:Z",
              "complaint_frequency!A:Z",
              "dispensing_summary!A:Z",
              "clearance_summary!A:Z",
              "refresh_metadata!A:Z",
            ],
          },
        });
      });

      const common = [snapshotId, publishedAt];
      await retryGoogleOperation(async () => {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: [
              {
                range: "daily_consultations!A1",
                values: [
                  [
                    "snapshot_id",
                    "published_at",
                    "consultation_date",
                    "total_consultations",
                    "student_consultations",
                    "faculty_consultations",
                    "visitor_consultations",
                    "appointment_visits",
                    "rfid_visits",
                  ],
                  ...snapshot.daily.map((row) => [
                    ...common,
                    row.consultation_date,
                    row.total_consultations,
                    row.student_consultations,
                    row.faculty_consultations,
                    row.visitor_consultations ?? 0,
                    row.appointment_visits,
                    row.rfid_visits,
                  ]),
                ],
              },
              {
                range: "complaint_frequency!A1",
                values: [
                  [
                    "snapshot_id",
                    "published_at",
                    "complaint_group",
                    "frequency",
                  ],
                  ...snapshot.complaints.map((row) => [
                    ...common,
                    row.complaint,
                    row.frequency,
                  ]),
                ],
              },
              {
                range: "dispensing_summary!A1",
                values: [
                  [
                    "snapshot_id",
                    "published_at",
                    "generic_name",
                    "brand_name",
                    "category",
                    "dispensing_events",
                    "quantity_dispensed",
                    "first_dispensed",
                    "last_dispensed",
                  ],
                  ...snapshot.dispensing.map((row) => [
                    ...common,
                    row.generic_name,
                    row.brand_name ?? "",
                    row.category ?? "",
                    row.total_dispensed,
                    row.total_quantity_dispensed,
                    row.first_dispensed ?? "",
                    row.last_dispensed ?? "",
                  ]),
                ],
              },
              {
                range: "clearance_summary!A1",
                values: [
                  [
                    "snapshot_id",
                    "published_at",
                    "requester_type",
                    "total_requests",
                    "approved",
                    "rejected",
                    "pending",
                    "evaluating",
                  ],
                  ...snapshot.clearances.map((row) => [
                    ...common,
                    row.requester_type,
                    row.total_requests,
                    row.approved,
                    row.rejected,
                    row.pending,
                    row.evaluating,
                  ]),
                ],
              },
            ],
          },
        });
      });

      await retryGoogleOperation(async () => {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "refresh_metadata!A1",
          valueInputOption: "RAW",
          requestBody: {
            values: [
              ["snapshot_id", "published_at", "status"],
              [snapshotId, publishedAt, "complete"],
            ],
          },
        });
      });
    },

    // Reuses an existing idempotent upload before creating a restricted file.
    async uploadWorkbook(input) {
      const escapedKey = input.idempotencyKey.replace(/'/g, "\\'");
      const existing = await retryGoogleOperation(async () =>
        drive.files.list({
          corpora: "allDrives",
          fields: "files(id,webViewLink)",
          includeItemsFromAllDrives: true,
          pageSize: 1,
          q: [
            `'${config.folderId}' in parents`,
            "trashed = false",
            `appProperties has { key='zentraqDeliveryKey' and value='${escapedKey}' }`,
          ].join(" and "),
          supportsAllDrives: true,
        }),
      );
      const found = existing.data.files?.[0];
      if (found?.id && found.webViewLink) {
        return {
          fileId: found.id,
          webViewLink: found.webViewLink,
        };
      }

      const created = await retryGoogleOperation(async () =>
        drive.files.create({
          fields: "id,webViewLink",
          supportsAllDrives: true,
          requestBody: {
            appProperties: {
              zentraqDeliveryKey: input.idempotencyKey,
              zentraqReportId: input.reportId,
            },
            copyRequiresWriterPermission: true,
            mimeType: REPORT_MIME,
            name: `zentraq-report-${input.reportId}.xlsx`,
            parents: [config.folderId],
            writersCanShare: false,
          },
          media: {
            body: Readable.from(Buffer.from(input.bytes)),
            mimeType: REPORT_MIME,
          },
        }),
      );
      if (!created.data.id || !created.data.webViewLink) {
        throw new GoogleWorkspaceError("GOOGLE_DRIVE_INVALID_RESPONSE", false);
      }
      return {
        fileId: created.data.id,
        webViewLink: created.data.webViewLink,
      };
    },
  };
}

// Retries only quota and temporary provider failures with bounded backoff.
export async function retryGoogleOperation<T>(
  operation: () => Promise<T>,
  delay: (milliseconds: number) => Promise<void> = wait,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = googleStatus(error);
      const retryable = status === 429 || (status !== null && status >= 500);
      if (!retryable || attempt === 2) {
        throw new GoogleWorkspaceError(
          retryable
            ? "GOOGLE_TEMPORARY_FAILURE"
            : "GOOGLE_PERMISSION_OR_REQUEST_FAILURE",
          retryable,
        );
      }
      await delay(250 * 2 ** attempt);
    }
  }
  throw new GoogleWorkspaceError("GOOGLE_TEMPORARY_FAILURE", true);
}

// Extracts only the HTTP status needed for safe retry classification.
function googleStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const response = "response" in error ? error.response : undefined;
  if (!response || typeof response !== "object") return null;
  const status = "status" in response ? response.status : undefined;
  return typeof status === "number" ? status : null;
}

// Waits between bounded provider retries.
function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
