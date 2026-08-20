import "jsr:@supabase/functions-js@2.112.3/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@1.3.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";

import { errorResponse, successResponse } from "../_shared/response.ts";

type CheckInRequest = { eventId: string; rfidUid: string };

type CheckInRow = {
  consultation_id: string;
  created_new: boolean;
  first_name: string;
  last_name: string;
  patient_id: string;
  patient_type: "student" | "faculty" | "staff";
  profile_photo_path: string | null;
  queue_entry_id: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Rejects RFID identifiers containing ASCII control characters.
function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

// Maps a protected RPC rejection to the minimum public RFID error contract.
function mapRpcError(error: { message?: string } | null): {
  code: string;
  message: string;
  status: number;
} {
  if (error?.message?.includes("RFID_NOT_REGISTERED")) {
    return {
      code: "PATIENT_NOT_FOUND",
      message: "This RFID card is not registered in Zentraq.",
      status: 404,
    };
  }
  if (error?.message?.includes("CLINICAL_OPERATOR_REQUIRED")) {
    return {
      code: "ACCESS_DENIED",
      message: "An active clinic operator account is required.",
      status: 403,
    };
  }
  if (error?.message?.includes("INVALID_RFID_REQUEST")) {
    return {
      code: "INVALID_REQUEST",
      message: "The check-in request is invalid.",
      status: 400,
    };
  }
  return {
    code: "CHECK_IN_FAILED",
    message: "Unable to check in this card.",
    status: 409,
  };
}

// Parses and validates one versioned RFID check-in request.
function parseRequest(body: string): CheckInRequest | null {
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const eventId = Reflect.get(value, "eventId");
    const rfidUid = Reflect.get(value, "rfidUid");
    if (
      typeof eventId !== "string" ||
      !UUID_PATTERN.test(eventId) ||
      typeof rfidUid !== "string" ||
      rfidUid.trim().length < 4 ||
      rfidUid.trim().length > 64 ||
      containsControlCharacter(rfidUid)
    ) {
      return null;
    }
    return { eventId, rfidUid: rfidUid.trim() };
  } catch {
    return null;
  }
}

// Uses a valid caller request ID or creates one for response correlation.
function requestIdFor(request: Request): string {
  const requestId = request.headers.get("x-request-id");
  return requestId && UUID_PATTERN.test(requestId)
    ? requestId
    : crypto.randomUUID();
}

// Converts an approved private photo path into a short-lived caller-scoped URL.
async function signedProfilePhotoUrl(
  client: SupabaseClient,
  path: string | null,
): Promise<string | null> {
  if (
    !path ||
    !/^(student|faculty|staff)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i
      .test(path)
  ) {
    return null;
  }
  const signed = await client.storage
    .from("clinic-profile-photos")
    .createSignedUrl(path, 5 * 60);
  return signed.error ? null : signed.data.signedUrl;
}

const rfidCheckIn = {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    const requestId = requestIdFor(request);
    if (request.method !== "POST") {
      return errorResponse(
        {
          code: "INVALID_REQUEST",
          message: "Only POST check-in requests are accepted.",
        },
        405,
        requestId,
      );
    }

    const body = await request.text();
    const input = parseRequest(body);
    if (!input) {
      return errorResponse(
        {
          code: "INVALID_REQUEST",
          message: "The check-in request is invalid.",
        },
        400,
        requestId,
      );
    }

    const client = context.supabase as SupabaseClient;
    const { data, error } = await client.rpc("check_in_rfid_v1", {
      requested_event_id: input.eventId,
      requested_rfid_uid: input.rfidUid,
    });
    const row = Array.isArray(data)
      ? data[0] as CheckInRow | undefined
      : undefined;
    if (error || !row) {
      console.error(JSON.stringify({
        code: error?.code ?? "CHECK_IN_REJECTED",
        event: "rfid_check_in_rejected",
        eventId: input.eventId,
        requestId,
      }));
      const mapped = mapRpcError(error);
      return errorResponse(
        { code: mapped.code, message: mapped.message },
        mapped.status,
        requestId,
      );
    }

    return successResponse(
      {
        clinicPhotoUrl: await signedProfilePhotoUrl(
          client,
          row.profile_photo_path,
        ),
        consultationId: row.consultation_id,
        createdNew: row.created_new,
        firstName: row.first_name,
        lastName: row.last_name,
        patientId: row.patient_id,
        patientType: row.patient_type,
        queueEntryId: row.queue_entry_id,
      },
      requestId,
    );
  }),
};

export default rfidCheckIn;
