"use server";

import { requireClinicStaff } from "@/actions/rfid/shared";
import { ZentraqApiError } from "@/lib/api/client";
import { authenticatedApiRequest } from "@/lib/api/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security/action-guard";

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

// Converts gateway RFID failures into the kiosk's stable error contract.
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
    error.status === 503
  ) {
    return "RFID check-in is temporarily unavailable";
  }
  return "Unable to check in this card";
}

// Validates and sends one RFID check-in through the Render gateway.
export async function checkInRfidAction(
  rfidUid: string,
  eventId?: string,
): Promise<{
  error: string | null;
  result: RfidCheckInResult | null;
}> {
  const auth = await requireClinicStaff();
  if (auth.error || !auth.user) {
    return { error: auth.error, result: null };
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
    `rfid-check-in:${auth.user.id}`,
    90,
    60 * 1000,
  );
  if (!rate.success) {
    return {
      error: "Too many check-in attempts. Try again shortly.",
      result: null,
    };
  }
  const requestEventId =
    eventId?.trim() || crypto.randomUUID();
  if (!UUID_PATTERN.test(requestEventId)) {
    return {
      error: "Invalid check-in request",
      result: null,
    };
  }
  try {
    const { data } =
      await authenticatedApiRequest<RfidCheckInResult>(
        "/api/v1/rfid/check-ins",
        {
          method: "POST",
          body: {
            eventId: requestEventId,
            rfidUid: uid,
          },
        },
      );
    return { error: null, result: data };
  } catch (error) {
    return {
      error: rfidErrorMessage(error),
      result: null,
    };
  }
}
