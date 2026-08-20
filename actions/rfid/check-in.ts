"use server";

import { ZentraqApiError } from "@/lib/api/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security/action-guard";
import { resolveProfilePhotoUrl } from "@/lib/storage/profile-photos";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_PHOTO_DATA_URL =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_PROFILE_PHOTO_BYTES = 150 * 1024;

export interface RfidCheckInResult {
  queueEntryId: string;
  consultationId: string;
  patientType: "student" | "faculty" | "staff";
  patientId: string;
  firstName: string;
  lastName: string;
  clinicPhotoUrl: string | null;
  createdNew: boolean;
}

// Narrows an unknown Edge payload to a plain record.
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

// Accepts only HTTPS or bounded legacy image data URLs, never raw Storage paths.
function parseClinicPhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const dataUrl = PROFILE_PHOTO_DATA_URL.exec(trimmed);
  if (dataUrl) {
    const payload = dataUrl[2];
    const padding = payload.endsWith("==")
      ? 2
      : payload.endsWith("=")
        ? 1
        : 0;
    const byteLength = Math.floor(payload.length * 3 / 4) - padding;
    return byteLength <= MAX_PROFILE_PHOTO_BYTES ? trimmed : null;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

// Resolves a missing Edge photo from the authoritative patient profile row.
async function resolveMissingClinicPhoto(
  result: RfidCheckInResult,
): Promise<string | null> {
  if (result.clinicPhotoUrl) return result.clinicPhotoUrl;

  try {
    const admin = createAdminClient();
    const table = result.patientType === "student"
      ? "students"
      : result.patientType;
    const { data, error } = await admin
      .from(table)
      .select("profile_photo_url")
      .eq("id", result.patientId)
      .maybeSingle();
    if (error || !data?.profile_photo_url) return null;

    return parseClinicPhotoUrl(
      await resolveProfilePhotoUrl(admin, data.profile_photo_url),
    );
  } catch {
    return null;
  }
}

// Validates both the deployed v4 result and the standardized Edge envelope.
function parseRfidResult(payload: unknown): RfidCheckInResult | null {
  const envelope = asRecord(payload);
  const result = asRecord(envelope?.data) ?? asRecord(envelope?.result);
  if (!result) return null;

  const patientType = result.patientType;
  const validPatientType =
    patientType === "student" ||
    patientType === "faculty" ||
    patientType === "staff";
  if (
    !validPatientType ||
    typeof result.queueEntryId !== "string" ||
    !UUID_PATTERN.test(result.queueEntryId) ||
    typeof result.consultationId !== "string" ||
    !UUID_PATTERN.test(result.consultationId) ||
    typeof result.patientId !== "string" ||
    !UUID_PATTERN.test(result.patientId) ||
    typeof result.firstName !== "string" ||
    typeof result.lastName !== "string" ||
    typeof result.createdNew !== "boolean"
  ) {
    return null;
  }

  return {
    queueEntryId: result.queueEntryId,
    consultationId: result.consultationId,
    patientType,
    patientId: result.patientId,
    firstName: result.firstName,
    lastName: result.lastName,
    clinicPhotoUrl: parseClinicPhotoUrl(result.clinicPhotoUrl),
    createdNew: result.createdNew,
  };
}

// Converts a Supabase Function error into the kiosk's stable API error type.
async function parseEdgeError(error: unknown): Promise<ZentraqApiError> {
  if (error instanceof FunctionsHttpError) {
    const payload: unknown = await error.context
      .clone()
      .json()
      .catch(() => null);
    const failure = asRecord(asRecord(payload)?.error);
    const code =
      typeof failure?.code === "string"
        ? failure.code
        : "RFID_CHECK_IN_FAILED";
    const message =
      typeof failure?.message === "string"
        ? failure.message
        : "Unable to check in this card.";
    return new ZentraqApiError(error.context.status, code, message);
  }

  return new ZentraqApiError(
    503,
    "RFID_EDGE_UNAVAILABLE",
    "RFID check-in is temporarily unavailable.",
  );
}

// Converts Edge RFID failures into the kiosk's stable error contract.
function rfidErrorMessage(error: unknown): string {
  if (
    error instanceof ZentraqApiError &&
    error.code === "PATIENT_NOT_FOUND"
  ) {
    return "This RFID card is not registered in Zentraq";
  }
  if (
    error instanceof ZentraqApiError &&
    error.code === "RATE_LIMITED"
  ) {
    return "Too many check-in attempts. Try again shortly.";
  }
  if (
    error instanceof ZentraqApiError &&
    [502, 503, 504].includes(error.status)
  ) {
    return "RFID check-in is temporarily unavailable";
  }
  return "Unable to check in this card";
}

// Validates and sends one idempotent RFID event directly to its Edge Function.
export async function checkInRfidAction(
  rfidUid: string,
  eventId?: string,
): Promise<{
  error: string | null;
  result: RfidCheckInResult | null;
}> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Not authenticated", result: null };
  }
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin", result: null };
  }

  const uid = rfidUid.trim();
  if (
    uid.length < 4 ||
    uid.length > 64 ||
    /[\u0000-\u001F\u007F]/.test(uid)
  ) {
    return { error: "Invalid RFID UID format", result: null };
  }

  const rate = checkRateLimit(
    `rfid-check-in:${user.id}`,
    90,
    60 * 1000,
  );
  if (!rate.success) {
    return {
      error: "Too many check-in attempts. Try again shortly.",
      result: null,
    };
  }

  const requestEventId = eventId?.trim() || crypto.randomUUID();
  if (!UUID_PATTERN.test(requestEventId)) {
    return {
      error: "Invalid check-in request",
      result: null,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "rfid-check-in",
      {
        body: {
          eventId: requestEventId,
          rfidUid: uid,
        },
      },
    );
    if (error) throw await parseEdgeError(error);

    const result = parseRfidResult(data);
    if (!result) {
      throw new ZentraqApiError(
        502,
        "INVALID_EDGE_RESPONSE",
        "The RFID service returned an invalid response.",
      );
    }
    return {
      error: null,
      result: {
        ...result,
        clinicPhotoUrl: await resolveMissingClinicPhoto(result),
      },
    };
  } catch (error) {
    return {
      error: rfidErrorMessage(error),
      result: null,
    };
  }
}
