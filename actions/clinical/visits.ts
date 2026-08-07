"use server";

import {
  ClearanceEvaluationSchema,
  ConsultationIdSchema,
  CreateClinicVisitSchema,
  CreateConsultationSchema,
  DiagnosisSchema,
  CreateHealthClearanceSchema,
  CreateHealthProgramSchema,
  CreateIncidentSchema,
  CreateMedicineSchema,
  CreateTriageAssessmentSchema,
  DispenseMedicineSchema,
  IssueCertificateSchema,
  SetVitalsDispositionSchema,
} from "@/lib/validation/schemas";
import { cookies } from "next/headers";
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { writeAuditLog } from "@/services/audit/audit-service";
import type { ActionResult } from "@/types";

export async function createWalkInVisit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await staff(["admin", "nurse"]);
  if (!actor) return forbidden();
  const parsed = CreateClinicVisitSchema.safeParse(input);
  if (!parsed.success || parsed.data.visit_type !== "walk-in") return invalid();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clinic_visits")
    .insert({ ...parsed.data, created_by: actor.id })
    .select("id")
    .single();
  if (error || !data) return databaseError();
  await writeAuditLog(actor, "visit.created", "clinic_visit", data.id, {
    visit_type: "walk-in",
  });
  return { success: true, data };
}

export async function createTriageAssessment(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();
  const parsed = CreateTriageAssessmentSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const admin = createAdminClient();
  const nurseId = await clinicAccountId(admin, actor.id);
  const { data, error } = await admin
    .from("triage_assessments")
    .insert({ ...parsed.data, nurse_id: nurseId })
    .select("id")
    .single();
  if (error || !data) return databaseError();
  await admin
    .from("consultations")
    .update({
      vitals_disposition: "recorded",
      vitals_skip_reason: null,
      vitals_assessed_by: actor.id,
      vitals_assessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.consultation_id);
  await writeAuditLog(
    actor,
    "triage.recorded",
    "consultation",
    parsed.data.consultation_id,
  );
  return { success: true, data };
}

// Claims a waiting RFID consultation using the authenticated operator session.
export async function claimConsultation(
  input: unknown,
): Promise<ActionResult<{ queueEntryId: string }>> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();
  const parsed = ConsultationIdSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("claim_consultation", {
    p_consultation_id: parsed.data.consultation_id,
  });

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "This consultation is no longer available",
      code: "INVALID_STATE",
    };
  }

  await writeAuditLog(
    actor,
    "consultation.claimed",
    "consultation",
    parsed.data.consultation_id,
  );
  return { success: true, data: { queueEntryId: data } };
}

// Records whether vital signs are required before the consultation can finish.
export async function setVitalsDisposition(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();
  const parsed = SetVitalsDispositionSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const { error } = await createAdminClient()
    .from("consultations")
    .update({
      vitals_disposition: parsed.data.disposition,
      vitals_skip_reason:
        parsed.data.disposition === "not_required"
          ? parsed.data.skip_reason?.trim()
          : null,
      vitals_assessed_by: actor.id,
      vitals_assessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.consultation_id)
    .eq("status", "in-progress");

  if (error) return databaseError();
  await writeAuditLog(
    actor,
    "consultation.vitals_assessed",
    "consultation",
    parsed.data.consultation_id,
    {
      disposition: parsed.data.disposition,
    },
  );
  return { success: true, data: null };
}

// Completes a consultation after database-side documentation checks pass.
export async function completeClinicalConsultation(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();
  const parsed = ConsultationIdSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("complete_consultation", {
    p_consultation_id: parsed.data.consultation_id,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
      code: "INVALID_STATE",
    };
  }

  await writeAuditLog(
    actor,
    "consultation.completed",
    "consultation",
    parsed.data.consultation_id,
  );
  return { success: true, data: null };
}

// Adds an optional diagnosis while an authorized clinician is handling a consultation.
export async function addConsultationDiagnosis(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await staff(["admin", "doctor"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();
  const parsed = DiagnosisSchema.safeParse(input);
  if (!parsed.success || !parsed.data.description?.trim()) return invalid();

  const { data, error } = await createAdminClient()
    .from("diagnoses")
    .insert({
      ...parsed.data,
      description: parsed.data.description.trim(),
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !data) return databaseError();
  await writeAuditLog(
    actor,
    "consultation.diagnosis_added",
    "consultation",
    parsed.data.consultation_id,
  );
  return { success: true, data };
}

export async function createConsultation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await staff(["doctor", "nurse"]);
  if (!actor) return forbidden();
  const parsed = CreateConsultationSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const admin = createAdminClient();
  const accountId = await clinicAccountId(admin, actor.id);
  const values = {
    ...parsed.data,
    doctor_id:
      actor.role === "doctor" ? accountId : (parsed.data.doctor_id ?? null),
    nurse_id:
      actor.role === "nurse" ? accountId : (parsed.data.nurse_id ?? null),
  };
  const { data, error } = await admin
    .from("consultations")
    .insert(values)
    .select("id")
    .single();
  if (error || !data) return databaseError();
  await writeAuditLog(actor, "consultation.created", "consultation", data.id);
  return { success: true, data };
}

export async function addMedicine(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await staff(["admin"]);
  if (!actor) return forbidden();
  const parsed = CreateMedicineSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const { data, error } = await createAdminClient()
    .from("medicines")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) return databaseError();
  await writeAuditLog(actor, "inventory.medicine_created", "medicine", data.id);
  return { success: true, data };
}

export async function dispenseMedicine(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await staff(["nurse"]);
  if (!actor) return forbidden();
  const parsed = DispenseMedicineSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const admin = createAdminClient();
  const [{ data: prescription }, { data: stock }] = await Promise.all([
    admin
      .from("prescriptions")
      .select("id, status, quantity")
      .eq("id", parsed.data.prescription_id)
      .maybeSingle(),
    admin
      .from("medicine_stock")
      .select("id, quantity")
      .eq("id", parsed.data.medicine_stock_id)
      .maybeSingle(),
  ]);
  if (!prescription || !stock)
    return {
      success: false,
      error: "Prescription or stock record not found",
      code: "NOT_FOUND",
    };
  if (
    prescription.status !== "pending" ||
    stock.quantity < parsed.data.quantity
  )
    return {
      success: false,
      error: "Dispensing is not permitted",
      code: "INVALID_STATE",
    };
  const { error } = await admin
    .from("dispensing_logs")
    .insert({ ...parsed.data, dispensed_by: actor.id });
  if (error) return databaseError();
  await admin
    .from("prescriptions")
    .update({ status: "dispensed" })
    .eq("id", prescription.id);
  await writeAuditLog(
    actor,
    "inventory.dispensed",
    "prescription",
    prescription.id,
    { quantity: parsed.data.quantity },
  );
  return { success: true, data: null };
}

export async function reportIncident(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return forbidden();
  const parsed = CreateIncidentSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const { data, error } = await createAdminClient()
    .from("incidents")
    .insert({ ...parsed.data, reported_by: actor.id })
    .select("id, severity")
    .single();
  if (error || !data) return databaseError();
  await writeAuditLog(actor, "incident.reported", "incident", data.id, {
    severity: data.severity,
  });
  return { success: true, data: { id: data.id } };
}

export async function submitClearanceRequest(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActionActor();
  if (
    !actor ||
    !hasAnyRole(actor, ["student", "faculty", "staff"]) ||
    !(await assertSameOrigin())
  )
    return forbidden();
  const admin = createAdminClient();
  const table = actor.role === "student" ? "students" : "faculty";
  const field = actor.role === "student" ? "student_id" : "faculty_id";
  const { data: profile } = await admin
    .from(table)
    .select("id")
    .eq("user_id", actor.id)
    .maybeSingle();
  if (!profile)
    return {
      success: false,
      error: "Patient profile not found",
      code: "NOT_FOUND",
    };
  const candidate = isObject(input)
    ? { ...input, requester_type: actor.role, [field]: profile.id }
    : input;
  const parsed = CreateHealthClearanceSchema.safeParse(candidate);
  if (!parsed.success) return invalid();
  const { data, error } = await admin
    .from("health_clearances")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) return databaseError();
  await admin
    .from("clearance_requests")
    .insert({ clearance_id: data.id, requested_by: actor.id });
  await writeAuditLog(
    actor,
    "clearance.requested",
    "health_clearance",
    data.id,
  );
  return { success: true, data };
}

export async function recordClearanceEvaluation(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await staff(["doctor"]);
  if (!actor) return forbidden();
  const parsed = ClearanceEvaluationSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const admin = createAdminClient();
  const doctorId = await clinicAccountId(admin, actor.id);
  const { error } = await admin
    .from("clearance_evaluations")
    .insert({ ...parsed.data, doctor_id: doctorId });
  if (error) return databaseError();
  await admin
    .from("health_clearances")
    .update({ status: "evaluating" })
    .eq("id", parsed.data.clearance_id);
  await writeAuditLog(
    actor,
    "clearance.evaluated",
    "health_clearance",
    parsed.data.clearance_id,
  );
  return { success: true, data: null };
}

export async function issueClearanceCertificate(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await staff(["admin"]);
  if (!actor) return forbidden();
  const parsed = IssueCertificateSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const admin = createAdminClient();
  const { data: evaluation } = await admin
    .from("clearance_evaluations")
    .select("id")
    .eq("clearance_id", parsed.data.clearance_id)
    .maybeSingle();
  if (!evaluation)
    return {
      success: false,
      error: "A doctor evaluation is required before issuing a certificate",
      code: "PRECONDITION",
    };
  const { data, error } = await admin
    .from("clearance_certificates")
    .insert({ ...parsed.data, issued_by: actor.id })
    .select("id")
    .single();
  if (error || !data) return databaseError();
  await admin
    .from("health_clearances")
    .update({ status: "approved" })
    .eq("id", parsed.data.clearance_id);
  await writeAuditLog(
    actor,
    "clearance.certificate_issued",
    "health_clearance",
    parsed.data.clearance_id,
  );
  return { success: true, data };
}

export async function createHealthProgram(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await staff(["admin"]);
  if (!actor) return forbidden();
  const parsed = CreateHealthProgramSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const { data, error } = await createAdminClient()
    .from("health_programs")
    .insert({ ...parsed.data, managed_by: actor.id })
    .select("id")
    .single();
  if (error || !data) return databaseError();
  await writeAuditLog(
    actor,
    "health_program.created",
    "health_program",
    data.id,
  );
  return { success: true, data };
}

async function staff(roles: readonly ("admin" | "doctor" | "nurse")[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}
async function clinicAccountId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function invalid(): ActionResult<never> {
  return { success: false, error: "Invalid input", code: "VALIDATION" };
}
function forbidden(): ActionResult<never> {
  return { success: false, error: "Forbidden", code: "FORBIDDEN" };
}
function databaseError(): ActionResult<never> {
  return {
    success: false,
    error: "Unable to complete the request",
    code: "DATABASE",
  };
}
