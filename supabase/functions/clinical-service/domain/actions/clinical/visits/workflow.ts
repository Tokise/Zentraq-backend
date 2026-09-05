import { getConsultationDraftAction } from "./drafts.ts";
import type { ConsultationDraft } from "../../../lib/clinical/draft-schema.ts";
import { createNotificationAction } from "../../../../runtime/notifications.ts";
import {
  ConsultationIdSchema,
  CreateClinicVisitSchema,
  CreateConsultationSchema,
  CreateMedicineSchema,
  DiagnosisSchema,
  FinalizeConsultationWorkflowSchema,
  IssueCertificateSchema,
  ReassignConsultationReviewSchema,
} from "../../../lib/validation/schemas.ts";
import { cookies } from "../../../../runtime/context.ts";
import { updateTag } from "../../../../runtime/effects.ts";
import { after } from "../../../../runtime/effects.ts";
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "../../../../runtime/context.ts";
import { createAdminClient } from "../../../../runtime/context.ts";
import { createClient } from "../../../../runtime/context.ts";
import { writeAuditLog } from "../../../services/audit/audit-service.ts";
import type { ActionResult } from "../../../types/index.ts";
import {
  type ConsultationDetailRow,
  getConsultationDetailAction,
} from "./queries.ts";
import { cachePolicy } from "../../../lib/cache/policy.ts";
import { redisDel, redisGet, redisSet } from "../../../lib/redis.ts";

export type ConsultationWorkflowRole = "admin" | "doctor" | "nurse";

export interface ConsultationWorkflowBootstrap {
  consultation: ConsultationDetailRow;
  role: ConsultationWorkflowRole;
  visitReasons: string[];
  draft?: ConsultationDraft | null;
}

export interface DiagnosisCatalogOption {
  code: string;
  description: string;
}

export interface MedicineDosageOption {
  dosage: string;
  medicineId: string;
}

export interface StartConsultationResult {
  queueEntryId: string;
  workflow: ConsultationWorkflowBootstrap | null;
}

export interface ConsultationClaimResult {
  queueEntryId: string;
}

export interface ConsultationCompletionSummary {
  completedAt: string | null;
  consultationId: string;
  status: "completed" | "awaiting_doctor_review";
}

// Loads the minimized authorized data needed to open a started consultation.
async function loadStartedConsultationWorkflow(
  consultationId: string,
  role: ConsultationWorkflowRole,
  reasonResultPromise: ReturnType<typeof getVisitReasonCatalogAction>,
): Promise<ConsultationWorkflowBootstrap | null> {
  const [detailResult, reasonResult, draftResult] = await Promise.all([
    getConsultationDetailAction(consultationId),
    reasonResultPromise,
    getConsultationDraftAction(consultationId),
  ]);
  if (
    detailResult.error ||
    !detailResult.consultation ||
    reasonResult.error || draftResult.error
  ) {
    return null;
  }
  return {
    consultation: detailResult.consultation,
    role,
    visitReasons: reasonResult.reasons,
    draft: draftResult.draft,
  };
}

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

export function createTriageAssessmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  void input;
  return Promise.resolve({
    success: false,
    error: "Vital signs are saved from the final consultation review.",
    code: "INVALID_STATE",
  });
}

// Claims a queued consultation without starting the clinical encounter.
export async function claimConsultationWorkflowAction(
  input: unknown,
): Promise<ActionResult<ConsultationClaimResult>> {
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
      error: "This consultation is no longer available",
      code: "INVALID_STATE",
    };
  }

  updateTag(`consultation-queue-${actor.id}`);
  return { success: true, data: { queueEntryId: data } };
}

// Starts an owned claim while allowing the client to reuse its prefetched DTO.
export async function startConsultationWorkflowAction(
  input: unknown,
): Promise<ActionResult<StartConsultationResult>> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();
  const parsed = ConsultationIdSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const { data, error } = await createClient().rpc(
    "claim_and_start_consultation",
    {
      p_consultation_id: parsed.data.consultation_id,
    },
  );
  if (error || !data) {
    return {
      success: false,
      error:
        "This consultation is unavailable or assigned to another clinician.",
      code: "INVALID_STATE",
    };
  }
  updateTag(`consultation-queue-${actor.id}`);
  const workflow = await loadStartedConsultationWorkflow(
    parsed.data.consultation_id,
    actor.role as ConsultationWorkflowRole,
    getVisitReasonCatalogAction(),
  ).catch(() => null);
  return { success: true, data: { queueEntryId: data, workflow } };
}

// Records whether vital signs are required before the consultation can finish.
export function setVitalsDispositionAction(
  input: unknown,
): Promise<ActionResult<null>> {
  void input;
  return Promise.resolve({
    success: false,
    error: "Vitals are saved from the final consultation review.",
    code: "INVALID_STATE",
  });
}

// Completes a consultation after database-side documentation checks pass.
export function completeClinicalConsultationAction(
  input: unknown,
): Promise<ActionResult<null>> {
  void input;
  return Promise.resolve({
    success: false,
    error: "Complete the consultation from its final review.",
    code: "INVALID_STATE",
  });
}

// Atomically persists the final doctor review or a nurse handoff.
export async function finalizeConsultationWorkflowAction(
  input: unknown,
): Promise<ActionResult<ConsultationCompletionSummary>> {
  const startedAt = performance.now();
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor || !(await assertSameOrigin())) return forbidden();

  const parsed = FinalizeConsultationWorkflowSchema.safeParse(input);
  if (!parsed.success) return invalid();

  if (
    actor.role === "nurse" &&
    (parsed.data.diagnosis ||
      parsed.data.treatment ||
      (parsed.data.prescriptions.length > 0 && !parsed.data.protocol_id) ||
      parsed.data.follow_up)
  ) {
    return forbidden();
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc(
    "finalize_consultation_workflow_v2",
    {
      p_protocol_id: parsed.data.protocol_id ?? null,
      p_eligibility: parsed.data.eligibility ?? null,
      p_nursing_assessment: parsed.data.nursing_assessment ?? null,
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
  updateTag(`consultation-queue-${actor.id}`);
  updateTag(`visit-history-${actor.id}`);
  updateTag(`dashboard-${actor.id}`);
  console.info(JSON.stringify({
    durationMs: Math.round(performance.now() - startedAt),
    event: "consultation_finalize",
    outcome: "success",
    status,
  }));
  after(async () => {
    await Promise.allSettled([
      syncConsultationLookupCatalogs(parsed.data),
      redisDel(
        cachePolicy.catalogs.visitReasons,
        "visit_reason_catalog",
      ),
      dispatchConsultationNotification(
        createAdminClient(),
        parsed.data.consultation_id,
        status,
        actor.id,
        parsed.data.review_doctor_id,
      ),
    ]);
  });
  return {
    success: true,
    data: {
      completedAt: status === "completed" ? new Date().toISOString() : null,
      consultationId: parsed.data.consultation_id,
      status,
    },
  };
}

// Lists server-governed diagnosis and medicine-specific dosage choices.
export async function getConsultationLookupCatalogsAction(): Promise<{
  diagnoses: DiagnosisCatalogOption[];
  dosages: MedicineDosageOption[];
  error: string | null;
}> {
  const actor = await staff(["admin", "doctor"]);
  if (!actor) return { diagnoses: [], dosages: [], error: "Access denied" };

  const admin = createAdminClient();
  const [diagnosisResult, dosageResult] = await Promise.all([
    admin
      .from("diagnosis_catalog")
      .select("code,description")
      .eq("is_active", true)
      .order("code")
      .limit(1000),
    admin
      .from("medicine_dosage_options")
      .select("medicine_id,dosage")
      .eq("is_active", true)
      .order("dosage")
      .limit(2000),
  ]);

  const catalogError = diagnosisResult.error ?? dosageResult.error;
  if (catalogError && !isMissingLookupCatalogError(catalogError)) {
    return {
      diagnoses: [],
      dosages: [],
      error: "Unable to load consultation choices",
    };
  }

  return {
    diagnoses: (diagnosisResult.data ?? []).map((item) => ({
      code: item.code,
      description: item.description,
    })),
    dosages: (dosageResult.data ?? []).map((item) => ({
      dosage: item.dosage,
      medicineId: item.medicine_id,
    })),
    error: null,
  };
}

// Preserves newly used coded diagnoses and dosages as future catalog options.
async function syncConsultationLookupCatalogs(
  input: {
    diagnosis?: {
      description: string;
      icd10_code?: string;
    };
    prescriptions: Array<{
      dosage?: string;
      medicine_id: string;
    }>;
  },
) {
  const admin = createAdminClient();
  const writes: Array<PromiseLike<{ error: { code?: string } | null }>> = [];

  if (input.diagnosis?.icd10_code && input.diagnosis.description) {
    writes.push(
      admin.from("diagnosis_catalog").insert({
        code: input.diagnosis.icd10_code,
        description: input.diagnosis.description,
      }),
    );
  }

  for (const prescription of input.prescriptions) {
    if (!prescription.medicine_id || !prescription.dosage) continue;
    writes.push(
      admin.from("medicine_dosage_options").insert({
        dosage: prescription.dosage,
        medicine_id: prescription.medicine_id,
      }),
    );
  }

  const results = await Promise.all(writes);
  const unexpectedError = results.find(
    (result) => result.error && result.error.code !== "23505",
  )?.error;
  if (unexpectedError && !isMissingLookupCatalogError(unexpectedError)) {
    console.warn("Consultation lookup catalog synchronization failed");
  }
}

// Recognizes deployments where the new lookup-catalog migration is pending.
function isMissingLookupCatalogError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("diagnosis_catalog") === true ||
    error.message?.includes("medicine_dosage_options") === true
  );
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

// Returns the approved visit-reason labels available to clinical staff.
export async function getVisitReasonCatalogAction(): Promise<{
  error: string | null;
  reasons: string[];
}> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", reasons: [] };

  const cached = await redisGet<string[]>(
    cachePolicy.catalogs.visitReasons,
    "visit_reason_catalog",
  );
  if (cached) return { error: null, reasons: cached };

  const { data, error } = await createAdminClient()
    .from("complaints")
    .select("name")
    .order("name", { ascending: true })
    .limit(500);

  if (error) return { error: error.message, reasons: [] };

  const reasons = deduplicateReasonNames(
    (data ?? [])
      .map((complaint) => complaint.name?.trim())
      .filter((name): name is string => Boolean(name)),
  );
  await redisSet(
    cachePolicy.catalogs.visitReasons,
    reasons,
    cachePolicy.catalogs.ttlSeconds,
    "visit_reason_catalog",
  );
  return { error: null, reasons };
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
    doctor_id: actor.role === "doctor"
      ? accountId
      : (parsed.data.doctor_id ?? null),
    nurse_id: actor.role === "nurse"
      ? accountId
      : (parsed.data.nurse_id ?? null),
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
  if (!evaluation) {
    return {
      success: false,
      error: "A doctor evaluation is required before issuing a certificate",
      code: "PRECONDITION",
    };
  }
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
      if (visit.patient_type === "student" && visit.student_id) {
        const { data: student } = await admin
          .from("students")
          .select("user_id")
          .eq("id", visit.student_id)
          .maybeSingle();
        patientUserId = student?.user_id ?? null;
      } else if (visit.patient_type === "faculty" && visit.faculty_id) {
        const { data: faculty } = await admin
          .from("faculty")
          .select("user_id")
          .eq("id", visit.faculty_id)
          .maybeSingle();
        patientUserId = faculty?.user_id ?? null;
      } else if (visit.patient_type === "staff" && visit.staff_id) {
        const { data: staff } = await admin
          .from("staff")
          .select("user_id")
          .eq("id", visit.staff_id)
          .maybeSingle();
        patientUserId = staff?.user_id ?? null;
      }

      // Notify the patient if they have an active user account (the DB trigger notifies the clinician operator)
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
