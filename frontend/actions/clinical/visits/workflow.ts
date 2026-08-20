"use server";

import { createNotificationAction } from "@/actions/communications/notifications";
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
  DispenseMedicineSchema,
  FinalizeConsultationWorkflowSchema,
  IssueCertificateSchema,
  ReassignConsultationReviewSchema,
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

export async function createWalkInVisitAction(
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

export async function createTriageAssessmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  void input;
  return {
    success: false,
    error: "Vital signs are saved from the final consultation review.",
    code: "INVALID_STATE",
  };
}

// Claims a waiting RFID consultation using the authenticated operator session.
export async function claimConsultationAction(
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

  return { success: true, data: { queueEntryId: data } };
}

// Records whether vital signs are required before the consultation can finish.
export async function setVitalsDispositionAction(
  input: unknown,
): Promise<ActionResult<null>> {
  void input;
  return {
    success: false,
    error: "Vitals are saved from the final consultation review.",
    code: "INVALID_STATE",
  };
}

// Completes a consultation after database-side documentation checks pass.
export async function completeClinicalConsultationAction(
  input: unknown,
): Promise<ActionResult<null>> {
  void input;
  return {
    success: false,
    error: "Complete the consultation from its final review.",
    code: "INVALID_STATE",
  };
}

// Atomically persists the final doctor review or a nurse handoff.
export async function finalizeConsultationWorkflowAction(
  input: unknown,
): Promise<ActionResult<{ status: "completed" | "awaiting_doctor_review" }>> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();

  const parsed = FinalizeConsultationWorkflowSchema.safeParse(input);
  if (!parsed.success) return invalid();

  if (
    actor.role === "nurse" &&
    (parsed.data.diagnosis ||
      parsed.data.treatment ||
      parsed.data.prescriptions.length > 0 ||
      parsed.data.follow_up)
  ) {
    return forbidden();
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc(
    "finalize_consultation_workflow",
    {
      p_consultation_id: parsed.data.consultation_id,
      p_patient_complaint: parsed.data.patient_complaint,
      p_review_doctor_id: parsed.data.review_doctor_id ?? null,
      p_vitals_disposition: parsed.data.vitals_disposition,
      p_vitals_skip_reason: parsed.data.vitals_skip_reason ?? null,
      p_vitals: parsed.data.vitals,
      p_notes: parsed.data.outcome_note ?? null,
      p_diagnosis: parsed.data.diagnosis ?? null,
      p_treatment: parsed.data.treatment ?? null,
      p_prescriptions: parsed.data.prescriptions,
      p_follow_up: parsed.data.follow_up ?? null,
    },
  );

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Unable to finalize the consultation",
      code: "INVALID_STATE",
    };
  }

  const status = data as "completed" | "awaiting_doctor_review";
  void dispatchConsultationNotification(
    createAdminClient(),
    parsed.data.consultation_id,
    status,
    actor.id,
    parsed.data.review_doctor_id,
  );
  return { success: true, data: { status } };
}

export interface AvailableReviewDoctor {
  clinicAccountId: string;
  displayName: string;
  availableUntil: string;
  activeReviewCount: number;
}

interface AvailableReviewDoctorRow {
  clinic_account_id: string;
  display_name: string;
  available_until: string;
  active_review_count: number;
}

export interface ClinicianDutyStatus {
  isOnDuty: boolean;
  expiresAt: string | null;
}

interface ClinicianDutyStatusRow {
  is_on_duty: boolean;
  expires_at: string | null;
}

// Returns selectable on-duty Doctors without exposing schedule internals.
export async function getAvailableReviewDoctorsAction(): Promise<{
  error: string | null;
  doctors: AvailableReviewDoctor[];
}> {
  const actor = await staff(["admin", "nurse"]);
  if (!actor) return { error: "Access denied", doctors: [] };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc(
    "get_available_review_doctors",
  );
  if (error) {
    return { error: "Unable to load available Doctors", doctors: [] };
  }

  return {
    error: null,
    doctors: ((data ?? []) as AvailableReviewDoctorRow[]).map((doctor) => ({
      clinicAccountId: doctor.clinic_account_id,
      displayName: doctor.display_name,
      availableUntil: doctor.available_until,
      activeReviewCount: Number(doctor.active_review_count),
    })),
  };
}

// Returns the current Doctor's expiring duty state.
export async function getMyClinicianDutyStatusAction(): Promise<{
  error: string | null;
  status: ClinicianDutyStatus | null;
}> {
  const actor = await staff(["doctor"]);
  if (!actor) return { error: "Access denied", status: null };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc(
    "get_my_clinician_duty_status",
  );
  const row = ((data ?? []) as ClinicianDutyStatusRow[])[0];
  if (error || !row) {
    return { error: "Unable to load duty status", status: null };
  }

  return {
    error: null,
    status: {
      isOnDuty: row.is_on_duty,
      expiresAt: row.expires_at,
    },
  };
}

// Changes the current Doctor's duty state inside an active schedule window.
export async function setMyClinicianDutyStatusAction(
  isOnDuty: boolean,
): Promise<ActionResult<ClinicianDutyStatus>> {
  const actor = await staff(["doctor"]);
  if (!actor || !(await assertSameOrigin()) || typeof isOnDuty !== "boolean") {
    return forbidden();
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc(
    "set_my_clinician_duty_status",
    { requested_on_duty: isOnDuty },
  );
  const row = ((data ?? []) as ClinicianDutyStatusRow[])[0];
  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Unable to change duty status",
      code: "INVALID_STATE",
    };
  }

  return {
    success: true,
    data: {
      isOnDuty: row.is_on_duty,
      expiresAt: row.expires_at,
    },
  };
}

// Reassigns an unclaimed Nurse handoff to an available Doctor or pending pool.
export async function reassignConsultationReviewAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await staff(["admin", "nurse"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();
  const parsed = ReassignConsultationReviewSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("reassign_consultation_review", {
    requested_consultation_id: parsed.data.consultation_id,
    requested_doctor_id: parsed.data.review_doctor_id,
  });
  if (error) {
    return {
      success: false,
      error: error.message,
      code: "INVALID_STATE",
    };
  }

  return { success: true, data: null };
}

// Returns the current clinic role for role-specific consultation controls.
export async function getClinicalWorkflowRoleAction(): Promise<
  "admin" | "doctor" | "nurse" | null
> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  return (actor?.role ?? null) as "admin" | "doctor" | "nurse" | null;
}

// Returns the approved visit-reason labels available to clinical staff.
export async function getVisitReasonCatalogAction(): Promise<{
  error: string | null;
  reasons: string[];
}> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", reasons: [] };

  const { data, error } = await createAdminClient()
    .from("complaints")
    .select("name")
    .order("name", { ascending: true })
    .limit(500);

  if (error) return { error: error.message, reasons: [] };

  return {
    error: null,
    reasons: deduplicateReasonNames(
      (data ?? [])
        .map((complaint) => complaint.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  };
}

// Adds an optional diagnosis while an authorized clinician is handling a consultation.
export async function addConsultationDiagnosisAction(
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

export async function createConsultationAction(
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

export async function addMedicineAction(
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

export async function dispenseMedicineAction(
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

export async function reportIncidentAction(
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

export async function submitClearanceRequestAction(
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

export async function recordClearanceEvaluationAction(
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

export async function issueClearanceCertificateAction(
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

export async function createHealthProgramAction(
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

// Returns the authenticated actor when they hold one of the allowed clinic roles.
async function staff(roles: readonly ("admin" | "doctor" | "nurse")[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}
// Resolves the active clinic account identifier for a signed-in user.
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
// Narrows unknown action input to a key-value object.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
// Returns the standard validation failure contract.
function invalid(): ActionResult<never> {
  return { success: false, error: "Invalid input", code: "VALIDATION" };
}
// Returns the standard authorization failure contract.
function forbidden(): ActionResult<never> {
  return { success: false, error: "Forbidden", code: "FORBIDDEN" };
}
// Returns a non-sensitive database failure contract.
function databaseError(): ActionResult<never> {
  return {
    success: false,
    error: "Unable to complete the request",
    code: "DATABASE",
  };
}

// Preserves display casing while removing normalized duplicate catalog names.
function deduplicateReasonNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const normalized = name.toLocaleLowerCase("en-US");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// Inserts a notification when a consultation is completed or assigned for doctor review.
async function dispatchConsultationNotification(
  admin: ReturnType<typeof createAdminClient>,
  consultationId: string,
  status: "completed" | "awaiting_doctor_review",
  actorId: string,
  reviewDoctorId?: string | null,
): Promise<void> {
  try {
    if (status === "completed") {
      const { data: consultation } = await admin
        .from("consultations")
        .select("id, visit_id")
        .eq("id", consultationId)
        .maybeSingle();

      if (!consultation?.visit_id) return;

      const { data: visit } = await admin
        .from("clinic_visits")
        .select("student_id, faculty_id, staff_id, patient_type")
        .eq("id", consultation.visit_id)
        .maybeSingle();

      if (!visit) return;

      let patientUserId: string | null = null;
      let patientName = "Patient";
      if (visit.patient_type === "student" && visit.student_id) {
        const { data: student } = await admin
          .from("students")
          .select("user_id, first_name, last_name")
          .eq("id", visit.student_id)
          .maybeSingle();
        patientUserId = student?.user_id ?? null;
        if (student?.first_name) {
          patientName = `${student.first_name} ${student.last_name}`.trim();
        }
      } else if (visit.patient_type === "faculty" && visit.faculty_id) {
        const { data: faculty } = await admin
          .from("faculty")
          .select("user_id, first_name, last_name")
          .eq("id", visit.faculty_id)
          .maybeSingle();
        patientUserId = faculty?.user_id ?? null;
        if (faculty?.first_name) {
          patientName = `${faculty.first_name} ${faculty.last_name}`.trim();
        }
      } else if (visit.patient_type === "staff" && visit.staff_id) {
        const { data: staff } = await admin
          .from("staff")
          .select("user_id, first_name, last_name")
          .eq("id", visit.staff_id)
          .maybeSingle();
        patientUserId = staff?.user_id ?? null;
        if (staff?.first_name) {
          patientName = `${staff.first_name} ${staff.last_name}`.trim();
        }
      }

      // Notify the clinician operator who completed the consultation
      await createNotificationAction({
        receiverId: actorId,
        title: "Consultation completed",
        message: `Consultation for ${patientName} has been successfully completed.`,
        type: "consultation",
        entityType: "consultation",
        entityId: consultationId,
      });

      // Notify the patient if they have an active user account
      if (patientUserId && patientUserId !== actorId) {
        await createNotificationAction({
          receiverId: patientUserId,
          title: "Consultation completed",
          message:
            "Your clinic consultation has been finalized. You can view your visit summary and prescriptions in your health records.",
          type: "consultation",
          entityType: "consultation",
          entityId: consultationId,
        });
      }
    } else if (status === "awaiting_doctor_review" && reviewDoctorId) {
      const { data: doctorAccount } = await admin
        .from("clinic_accounts")
        .select("user_id")
        .eq("id", reviewDoctorId)
        .maybeSingle();

      if (doctorAccount?.user_id) {
        await createNotificationAction({
          receiverId: doctorAccount.user_id,
          title: "Consultation review assigned",
          message:
            "A new patient consultation has been referred to you for medical review.",
          type: "consultation",
          entityType: "consultation",
          entityId: consultationId,
        });
      }

      // Notify the nurse who submitted the handoff
      await createNotificationAction({
        receiverId: actorId,
        title: "Consultation submitted for review",
        message:
          "The patient consultation handoff has been sent for doctor review.",
        type: "consultation",
        entityType: "consultation",
        entityId: consultationId,
      });
    }
  } catch {
    // Non-blocking notification dispatch
  }
}
