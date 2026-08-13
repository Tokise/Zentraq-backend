"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logAuditEvent } from "@/lib/audit-logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { isRfidEdgeEnabled } from "@/lib/serverless/rfid-rollout";
import { assertSameOrigin } from "@/lib/security/action-guard";
import { resolveProfilePhotoUrl } from "@/lib/storage/profile-photos";
import { requireClinicStaff } from "@/actions/rfid/shared";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function getRfidInvokeErrorMessage(error: unknown): Promise<string> {
  if (!error || typeof error !== "object") {
    return "Unable to check in this card";
  }

  const context = Reflect.get(error, "context");
  if (!(context instanceof Response)) {
    return "Unable to check in this card";
  }

  try {
    const body: unknown = await context.clone().json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return "Unable to check in this card";
    }

    const publicError = Reflect.get(body, "error");
    if (!publicError || typeof publicError !== "object") {
      return "Unable to check in this card";
    }

    return Reflect.get(publicError, "code") === "PATIENT_NOT_FOUND"
      ? "This RFID card is not registered in Zentraq"
      : "Unable to check in this card";
  } catch {
    return "Unable to check in this card";
  }
}

export async function checkInRfidAction(
  rfidUid: string,
  eventId?: string,
): Promise<{ error: string | null; result: RfidCheckInResult | null }> {
  const auth = await requireClinicStaff();
  if (auth.error || !auth.user) return { error: auth.error, result: null };
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin", result: null };
  }

  const uid = rfidUid.trim();
  if (uid.length < 4 || uid.length > 64 || /[\u0000-\u001F\u007F]/.test(uid)) {
    return { error: "Invalid RFID UID format", result: null };
  }

  const rate = checkRateLimit(`rfid-check-in:${auth.user.id}`, 90, 60 * 1000);
  if (!rate.success) {
    return { error: "Too many check-in attempts. Try again shortly.", result: null };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const requestEventId = eventId?.trim() || crypto.randomUUID();
  if (!UUID_PATTERN.test(requestEventId)) {
    return { error: "Invalid check-in request", result: null };
  }

  if (!isRfidEdgeEnabled(auth.user.id)) {
    return {
      error: "RFID check-in is temporarily unavailable",
      result: null,
    };
  }

  const { data, error } = await supabase.functions.invoke("rfid-check-in", {
    body: { eventId: requestEventId, rfidUid: uid },
  });
  const result = data?.result as RfidCheckInResult | undefined;
  if (error || !result) {
    return {
      error: await getRfidInvokeErrorMessage(error),
      result: null,
    };
  }
  result.clinicPhotoUrl = await resolveProfilePhotoUrl(
    createAdminClient(),
    result.clinicPhotoUrl,
  );
  await logRfidExecution(
    auth.user.id,
    auth.user.email ?? null,
    requestEventId,
    result,
  );
  return { error: null, result };
}

// Writes a PHI-free audit record for an RFID Edge Function execution.
async function logRfidExecution(
  userId: string,
  email: string | null,
  eventId: string,
  result: RfidCheckInResult,
) {
  await logAuditEvent({
    action: "RFID_SCAN",
    userId,
    email,
    resource: result.queueEntryId,
    details: {
      eventId,
      executionPath: "edge",
      resultStatus: "success",
      createdNew: result.createdNew,
      patientType: result.patientType,
    },
  });
}

/**
 * Server Action: Look up a patient profile by RFID UID for the kiosk.
 * Uses Service Role via createAdminClient() — NEVER exposes full student records.
 * Requires clinic staff authentication.
 */
