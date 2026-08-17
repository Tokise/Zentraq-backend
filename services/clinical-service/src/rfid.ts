import type { Request } from "express";
import { z } from "zod";

import {
  AppError,
  createAdminClient,
  requiredEnvironment,
} from "@zentraq/shared";

export const rfidCheckInSchema = z.object({
  eventId: z.string().uuid(),
  rfidUid: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .refine((value) => !containsControlCharacter(value)),
});

const rfidResultSchema = z.object({
  clinicPhotoUrl: z.string().max(512).nullable(),
  consultationId: z.string().uuid(),
  createdNew: z.boolean(),
  firstName: z.string().min(1).max(160),
  lastName: z.string().min(1).max(160),
  patientId: z.string().uuid(),
  patientType: z.enum(["student", "faculty", "staff"]),
  queueEntryId: z.string().uuid(),
});

const rfidFailureSchema = z.object({
  error: z.object({
    code: z.string().max(80).optional(),
  }),
});

export interface RfidCheckInResult {
  clinicPhotoUrl: string | null;
  consultationId: string;
  createdNew: boolean;
  firstName: string;
  lastName: string;
  patientId: string;
  patientType: "student" | "faculty" | "staff";
  queueEntryId: string;
}

export type RfidCheckInInvoker = (
  input: z.infer<typeof rfidCheckInSchema>,
  accessToken: string,
  timeoutMs: number,
) => Promise<RfidCheckInResult>;

const rfidRateBuckets = new Map<
  string,
  { count: number; resetAt: number }
>();

// Rejects RFID identifiers containing ASCII control characters.
function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

// Enforces a short user-scoped budget in addition to the gateway IP limit.
export function enforceRfidRateLimit(userId: string): void {
  const now = Date.now();
  const current = rfidRateBuckets.get(userId);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + 60_000 }
      : current;
  bucket.count += 1;
  rfidRateBuckets.set(userId, bucket);
  if (bucket.count > 90) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many check-in attempts. Try again shortly.",
    );
  }
}

// Extracts the original user token forwarded only by the signed gateway path.
export function requireForwardedAccessToken(request: Request): string {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }
  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }
  return accessToken;
}

// Invokes the retained RFID Edge Function with the caller's RLS identity.
export async function invokeRfidEdgeFunction(
  input: z.infer<typeof rfidCheckInSchema>,
  accessToken: string,
  timeoutMs: number,
): Promise<RfidCheckInResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${requiredEnvironment("SUPABASE_URL")}/functions/v1/rfid-check-in`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          apikey: requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      },
    );
    const payload: unknown = await response.json();
    if (!response.ok) {
      const failure = rfidFailureSchema.safeParse(payload);
      throw mapRfidFunctionError(
        response.status,
        failure.success
          ? failure.data.error.code
          : undefined,
      );
    }
    const parsed = z
      .object({ result: rfidResultSchema })
      .safeParse(payload);
    if (!parsed.success) {
      throw new AppError(
        503,
        "RFID_SERVICE_UNAVAILABLE",
        "RFID check-in is temporarily unavailable.",
      );
    }
    return {
      ...parsed.data.result,
      clinicPhotoUrl: await signClinicPhoto(
        parsed.data.result.clinicPhotoUrl,
      ),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "RFID_SERVICE_UNAVAILABLE",
      "RFID check-in is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Maps Edge Function failures to stable gateway-safe errors.
function mapRfidFunctionError(status: number, code?: string): AppError {
  if (code === "PATIENT_NOT_FOUND") {
    return new AppError(
      404,
      "PATIENT_NOT_FOUND",
      "This RFID card is not registered in Zentraq.",
    );
  }
  if (status === 401 || status === 403) {
    return new AppError(403, "FORBIDDEN", "RFID check-in is not permitted.");
  }
  if (status >= 500) {
    return new AppError(
      503,
      "RFID_SERVICE_UNAVAILABLE",
      "RFID check-in is temporarily unavailable.",
    );
  }
  return new AppError(409, "CHECK_IN_FAILED", "Unable to check in this card.");
}

// Converts a bounded private profile-photo path to a five-minute URL.
async function signClinicPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (
    !/^(student|faculty|staff)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(
      path,
    )
  ) {
    return null;
  }
  const signed = await createAdminClient()
    .storage.from("clinic-profile-photos")
    .createSignedUrl(path, 5 * 60);
  return signed.error ? null : signed.data.signedUrl;
}
