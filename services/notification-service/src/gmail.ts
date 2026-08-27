import { createHash } from "node:crypto";

import { google } from "googleapis";
import { z } from "zod";

const gmailEnvironmentSchema = z.object({
  allowedDomain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+$/),
  clientId: z.string().trim().min(10),
  clientSecret: z.string().trim().min(10),
  refreshToken: z.string().trim().min(10),
  sender: z.string().email().transform((value) => value.toLowerCase()),
});

export interface GmailEnvironment {
  GOOGLE_GMAIL_ALLOWED_DOMAIN?: string;
  GOOGLE_GMAIL_ALLOWED_RECIPIENTS?: string;
  GOOGLE_GMAIL_CLIENT_ID?: string;
  GOOGLE_GMAIL_CLIENT_SECRET?: string;
  GOOGLE_GMAIL_ENABLED?: string;
  GOOGLE_GMAIL_REFRESH_TOKEN?: string;
  GOOGLE_GMAIL_SENDER?: string;
}

export interface ReportEmailInput {
  deliveryJobId: string;
  generatedAt: string;
  recipient: string;
  reportName: string;
  reportPeriod: string;
  restrictedDriveLink?: string;
  supportContact: string;
  templateKey: "report.delivery_failed" | "report.ready";
}

interface GmailConfig {
  allowedDomain: string;
  allowedRecipients: Set<string>;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  sender: string;
}

export interface GmailSender {
  sendReportEmail(input: ReportEmailInput): Promise<string>;
}

// Represents a sanitized Gmail delivery failure.
export class GmailDeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "GmailDeliveryError";
  }
}

// Loads the narrow Gmail send-only configuration when enabled.
export function loadGmailConfig(
  environment: GmailEnvironment = process.env,
): GmailConfig | null {
  if (environment.GOOGLE_GMAIL_ENABLED !== "true") return null;

  const parsed = gmailEnvironmentSchema.safeParse({
    allowedDomain: environment.GOOGLE_GMAIL_ALLOWED_DOMAIN,
    clientId: environment.GOOGLE_GMAIL_CLIENT_ID,
    clientSecret: environment.GOOGLE_GMAIL_CLIENT_SECRET,
    refreshToken: environment.GOOGLE_GMAIL_REFRESH_TOKEN,
    sender: environment.GOOGLE_GMAIL_SENDER,
  });
  if (!parsed.success) {
    throw new Error("Google Gmail configuration is invalid.");
  }
  if (!emailAllowed(parsed.data.sender, parsed.data.allowedDomain, new Set())) {
    throw new Error("GOOGLE_GMAIL_SENDER must use the allowed Workspace domain.");
  }

  return {
    ...parsed.data,
    allowedRecipients: new Set(
      (environment.GOOGLE_GMAIL_ALLOWED_RECIPIENTS ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  };
}

// Creates a sender that can only send fixed, metadata-only report templates.
export function createGmailSender(
  environment: GmailEnvironment = process.env,
): GmailSender | null {
  const config = loadGmailConfig(environment);
  if (!config) return null;

  const auth = new google.auth.OAuth2({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  auth.setCredentials({ refresh_token: config.refreshToken });
  const gmail = google.gmail({ auth, version: "v1" });

  return {
    // Sends a fixed plain-text template without report contents or attachments.
    async sendReportEmail(input) {
      const recipient = input.recipient.trim().toLowerCase();
      if (!emailAllowed(
        recipient,
        config.allowedDomain,
        config.allowedRecipients,
      )) {
        throw new GmailDeliveryError("GMAIL_RECIPIENT_NOT_ALLOWED", false);
      }
      if (
        input.templateKey === "report.ready" &&
        !input.restrictedDriveLink
      ) {
        throw new GmailDeliveryError("GMAIL_DRIVE_LINK_REQUIRED", false);
      }

      const subject = input.templateKey === "report.ready"
        ? `Zentraq report ready: ${safeLine(input.reportName)}`
        : `Zentraq report delivery failed: ${safeLine(input.reportName)}`;
      const body = input.templateKey === "report.ready"
        ? [
            `Report: ${safeLine(input.reportName)}`,
            `Period: ${safeLine(input.reportPeriod)}`,
            `Generated: ${safeLine(input.generatedAt)}`,
            `Restricted Drive link: ${input.restrictedDriveLink}`,
            "Access is controlled by the school Google Workspace administrator.",
            `Support: ${safeLine(input.supportContact)}`,
          ].join("\r\n")
        : [
            `Report: ${safeLine(input.reportName)}`,
            `Period: ${safeLine(input.reportPeriod)}`,
            "External delivery did not complete. The private Zentraq report remains available.",
            `Support: ${safeLine(input.supportContact)}`,
          ].join("\r\n");
      const recipientHash = createHash("sha256")
        .update(recipient)
        .digest("hex")
        .slice(0, 20);
      const raw = [
        `From: ${config.sender}`,
        `To: ${recipient}`,
        `Subject: ${subject}`,
        `Message-ID: <${input.deliveryJobId}.${recipientHash}@${config.allowedDomain}>`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        body,
      ].join("\r\n");

      const result = await retryGmailOperation(async () =>
        gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: Buffer.from(raw, "utf8").toString("base64url"),
          },
        }),
      );
      if (!result.data.id) {
        throw new GmailDeliveryError("GMAIL_INVALID_RESPONSE", false);
      }
      return result.data.id;
    },
  };
}

// Checks the Workspace domain or an explicit operator-managed allowlist.
export function emailAllowed(
  email: string,
  domain: string,
  allowlist: Set<string>,
): boolean {
  const normalized = email.trim().toLowerCase();
  const parsed = z.string().email().safeParse(normalized);
  if (!parsed.success) return false;
  return normalized.endsWith(`@${domain}`) || allowlist.has(normalized);
}

// Retries only quota and temporary Gmail failures.
export async function retryGmailOperation<T>(
  operation: () => Promise<T>,
  delay: (milliseconds: number) => Promise<void> = wait,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof GmailDeliveryError) throw error;
      const status = googleStatus(error);
      const retryable = status === 429 || (status !== null && status >= 500);
      if (!retryable || attempt === 2) {
        throw new GmailDeliveryError(
          retryable
            ? "GMAIL_TEMPORARY_FAILURE"
            : "GMAIL_PERMISSION_OR_REQUEST_FAILURE",
          retryable,
        );
      }
      await delay(250 * 2 ** attempt);
    }
  }
  throw new GmailDeliveryError("GMAIL_TEMPORARY_FAILURE", true);
}

// Removes line breaks from values used in mail headers and fixed fields.
function safeLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

// Extracts only the HTTP status needed for retry classification.
function googleStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const response = "response" in error ? error.response : undefined;
  if (!response || typeof response !== "object") return null;
  const status = "status" in response ? response.status : undefined;
  return typeof status === "number" ? status : null;
}

// Waits between bounded Gmail retries.
function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
