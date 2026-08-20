import "jsr:@supabase/functions-js@2.112.3/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@1.3.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";

import { verifyGatewayRequest } from "../_shared/gateway.ts";
import { errorResponse, successResponse } from "../_shared/response.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATIENT_TYPES = new Set(["student", "faculty", "staff"]);

type PatientType = "student" | "faculty" | "staff";

type PatientReferenceRow = {
  patient_id: string;
  patient_type: PatientType;
};

interface FinalizeInput {
  diagnosis: unknown;
  followUp: unknown;
  notes: string;
  patientComplaint: string;
  prescriptions: unknown[];
  reviewDoctorId: string | null;
  treatment: unknown;
  vitals: unknown;
  vitalsDisposition: string;
  vitalsSkipReason: string;
}

// Parses a bounded page request without trusting arbitrary range values.
function pagination(url: URL): {
  from: number;
  limit: number;
  page: number;
  to: number;
} {
  const page = Math.max(
    1,
    Math.min(10_000, Number(url.searchParams.get("page")) || 1),
  );
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit")) || 25),
  );
  const from = (page - 1) * limit;
  return { from, limit, page, to: from + limit - 1 };
}

// Returns stable pagination metadata calculated only by the server.
function paginationMeta(page: number, limit: number, total: number) {
  return {
    limit,
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// Loads a minimized medical record through caller-scoped RLS.
async function loadPatientRecord(
  client: SupabaseClient,
  patientType: PatientType,
  patientId: string,
): Promise<{ error: boolean; value?: unknown }> {
  const patientColumn = `${patientType}_id`;
  const visits = await client
    .from("clinic_visits")
    .select("id,check_in_time,check_out_time,visit_type,status")
    .eq(patientColumn, patientId)
    .order("check_in_time", { ascending: false })
    .limit(100);
  if (visits.error) return { error: true };
  const visitIds = (visits.data ?? []).map((visit) => visit.id);
  if (visitIds.length === 0) {
    return {
      error: false,
      value: {
        consultations: [],
        patient: { id: patientId, patientType },
        visits: [],
      },
    };
  }
  const consultations = await client
    .from("consultations")
    .select(
      "id,visit_id,patient_complaint,consultation_notes,status,doctor_id,nurse_id,created_at,completed_at",
    )
    .in("visit_id", visitIds)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(100);
  if (consultations.error) return { error: true };
  return {
    error: false,
    value: {
      consultations: consultations.data ?? [],
      patient: { id: patientId, patientType },
      visits: visits.data ?? [],
    },
  };
}

// Parses the finalization payload before invoking the atomic workflow RPC.
function parseFinalizeInput(body: string): FinalizeInput | null {
  try {
    const input: unknown = JSON.parse(body);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return null;
    }
    const notes = Reflect.get(input, "notes");
    const patientComplaint = Reflect.get(input, "patientComplaint");
    const reviewDoctorId = Reflect.get(input, "reviewDoctorId");
    const vitalsDisposition = Reflect.get(input, "vitalsDisposition");
    const vitalsSkipReason = Reflect.get(input, "vitalsSkipReason");
    const prescriptions = Reflect.get(input, "prescriptions");
    if (
      typeof notes !== "string" ||
      notes.trim().length < 1 ||
      notes.trim().length > 5_000 ||
      typeof patientComplaint !== "string" ||
      patientComplaint.trim().length > 120 ||
      typeof vitalsDisposition !== "string" ||
      vitalsDisposition.length > 40 ||
      typeof vitalsSkipReason !== "string" ||
      vitalsSkipReason.length > 500 ||
      (reviewDoctorId !== null &&
        reviewDoctorId !== undefined &&
        (typeof reviewDoctorId !== "string" ||
          !UUID_PATTERN.test(reviewDoctorId))) ||
      !Array.isArray(prescriptions) ||
      prescriptions.length > 50
    ) {
      return null;
    }
    return {
      diagnosis: Reflect.get(input, "diagnosis") ?? null,
      followUp: Reflect.get(input, "followUp") ?? null,
      notes: notes.trim(),
      patientComplaint: patientComplaint.trim(),
      prescriptions,
      reviewDoctorId: typeof reviewDoctorId === "string"
        ? reviewDoctorId
        : null,
      treatment: Reflect.get(input, "treatment") ?? null,
      vitals: Reflect.get(input, "vitals") ?? {},
      vitalsDisposition,
      vitalsSkipReason: vitalsSkipReason.trim(),
    };
  } catch {
    return null;
  }
}

const clinicalService = {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    const body = await request.text();
    const gateway = await verifyGatewayRequest(
      request,
      body,
      [
        "/api/v1/records",
        "/api/v1/consultations",
        "/api/v1/visits",
        "/api/v1/clinical",
      ],
    );
    if (!gateway) {
      return errorResponse(
        {
          code: "GATEWAY_SIGNATURE_REQUIRED",
          message: "Gateway authorization failed.",
        },
        403,
      );
    }

    const url = new URL(gateway.path, "https://gateway.local");
    const path = url.pathname;
    const client = context.supabase as SupabaseClient;

    if (request.method === "GET" && path === "/api/v1/records/me") {
      const reference = await client.rpc("resolve_patient_reference_v1");
      const patient = Array.isArray(reference.data)
        ? reference.data[0] as PatientReferenceRow | undefined
        : undefined;
      if (reference.error || !patient) {
        return errorResponse(
          {
            code: "PATIENT_NOT_FOUND",
            message: "Patient profile not found.",
          },
          404,
          gateway.requestId,
        );
      }
      const record = await loadPatientRecord(
        client,
        patient.patient_type,
        patient.patient_id,
      );
      if (record.error) return databaseError(gateway.requestId);
      return successResponse(record.value, gateway.requestId);
    }

    const patientMatch = path.match(
      /^\/api\/v1\/records\/(student|faculty|staff)\/([0-9a-f-]+)$/i,
    );
    if (request.method === "GET" && patientMatch) {
      const patientType = patientMatch[1].toLowerCase();
      const patientId = patientMatch[2];
      if (!PATIENT_TYPES.has(patientType) || !UUID_PATTERN.test(patientId)) {
        return validationError(gateway.requestId);
      }
      const record = await loadPatientRecord(
        client,
        patientType as PatientType,
        patientId,
      );
      if (record.error) return databaseError(gateway.requestId);
      return successResponse(record.value, gateway.requestId);
    }

    if (request.method === "GET" && path === "/api/v1/consultations") {
      const range = pagination(url);
      const result = await client
        .from("consultations")
        .select(
          "id,visit_id,appointment_id,doctor_id,nurse_id,patient_complaint,status,created_at,completed_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(range.from, range.to);
      if (result.error) return databaseError(gateway.requestId);
      return collectionResponse(
        result.data ?? [],
        range,
        result.count ?? 0,
        gateway.requestId,
      );
    }

    if (request.method === "GET" && path === "/api/v1/visits") {
      const range = pagination(url);
      const result = await client
        .from("clinic_visits")
        .select(
          "id,patient_type,student_id,faculty_id,staff_id,check_in_time,check_out_time,visit_type,status,created_at",
          { count: "exact" },
        )
        .order("check_in_time", { ascending: false })
        .range(range.from, range.to);
      if (result.error) return databaseError(gateway.requestId);
      return collectionResponse(
        result.data ?? [],
        range,
        result.count ?? 0,
        gateway.requestId,
      );
    }

    const claimMatch = path.match(
      /^\/api\/v1\/clinical\/consultations\/([0-9a-f-]+)\/claim$/i,
    );
    if (request.method === "POST" && claimMatch) {
      const consultationId = claimMatch[1];
      if (!UUID_PATTERN.test(consultationId)) {
        return validationError(gateway.requestId);
      }
      const result = await client.rpc("claim_consultation", {
        p_consultation_id: consultationId,
      });
      if (result.error || typeof result.data !== "string") {
        return workflowError(
          "The consultation could not be claimed.",
          gateway.requestId,
        );
      }
      return successResponse(
        { queueEntryId: result.data },
        gateway.requestId,
      );
    }

    const finalizeMatch = path.match(
      /^\/api\/v1\/clinical\/consultations\/([0-9a-f-]+)\/finalize$/i,
    );
    if (request.method === "POST" && finalizeMatch) {
      const consultationId = finalizeMatch[1];
      const input = parseFinalizeInput(body);
      if (!UUID_PATTERN.test(consultationId) || !input) {
        return validationError(gateway.requestId);
      }
      const result = await client.rpc("finalize_consultation_workflow", {
        p_consultation_id: consultationId,
        p_diagnosis: input.diagnosis,
        p_follow_up: input.followUp,
        p_notes: input.notes,
        p_patient_complaint: input.patientComplaint,
        p_prescriptions: input.prescriptions,
        p_review_doctor_id: input.reviewDoctorId,
        p_treatment: input.treatment,
        p_vitals: input.vitals,
        p_vitals_disposition: input.vitalsDisposition,
        p_vitals_skip_reason: input.vitalsSkipReason,
      });
      if (result.error || typeof result.data !== "string") {
        return workflowError(
          "The consultation could not be finalized.",
          gateway.requestId,
        );
      }
      return successResponse(
        { status: result.data },
        gateway.requestId,
      );
    }

    return errorResponse(
      { code: "NOT_FOUND", message: "Clinical route not found." },
      404,
      gateway.requestId,
    );
  }),
};

// Returns a paginated standard success envelope.
function collectionResponse(
  data: unknown[],
  range: { limit: number; page: number },
  total: number,
  requestId: string,
): Response {
  return Response.json(
    {
      data,
      pagination: paginationMeta(range.page, range.limit, total),
      success: true,
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}

// Returns a stable validation failure.
function validationError(requestId: string): Response {
  return errorResponse(
    { code: "VALIDATION_ERROR", message: "Invalid clinical request." },
    400,
    requestId,
  );
}

// Returns a stable workflow conflict without leaking protected state.
function workflowError(message: string, requestId: string): Response {
  return errorResponse(
    { code: "CLINICAL_WORKFLOW_REJECTED", message },
    409,
    requestId,
  );
}

// Returns a stable database failure without leaking details.
function databaseError(requestId: string): Response {
  return errorResponse(
    {
      code: "DATABASE_UNAVAILABLE",
      message: "Clinical data is temporarily unavailable.",
    },
    503,
    requestId,
  );
}

export default clinicalService;
