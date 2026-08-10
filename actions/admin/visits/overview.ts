"use server";

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

type StaffRole = "admin" | "doctor" | "nurse";

// Returns the authenticated actor when they hold one of the allowed clinic roles.
async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

export interface ClinicVisitRow {
  id: string;
  patient_type: "student" | "faculty" | "staff";
  patient_name: string | null;
  visit_type: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  consultation_count: number;
}

interface ClinicVisitQueryRow {
  id: string;
  patient_type: "student" | "faculty" | "staff";
  visit_type: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  students:
    | Array<{ first_name: string; last_name: string; student_number: string }>
    | { first_name: string; last_name: string; student_number: string }
    | null;
  faculty:
    | Array<{ first_name: string; last_name: string; employee_number: string }>
    | { first_name: string; last_name: string; employee_number: string }
    | null;
  staff:
    | Array<{ first_name: string; last_name: string; employee_number: string }>
    | { first_name: string; last_name: string; employee_number: string }
    | null;
  consultations: Array<{ id: string }> | { id: string } | null;
}

// Returns clinic-wide visit rows for the administrator workspace.
export async function getClinicVisitsAction(params?: {
  status?: string;
  searchQuery?: string;
}): Promise<{ error: string | null; visits: ClinicVisitRow[] }> {
  const actor = await staff(["admin"]);
  if (!actor) return { error: "Access denied", visits: [] as ClinicVisitRow[] };

  const admin = createAdminClient();
  let query = admin
    .from("clinic_visits")
    .select(
      `
      id, patient_type, visit_type, check_in_time, check_out_time, status,
      students(first_name, last_name, student_number),
      faculty(first_name, last_name, employee_number),
      staff(first_name, last_name, employee_number),
      consultations(id)
    `,
    )
    .order("check_in_time", { ascending: false })
    .limit(100);

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  if (error) return { error: error.message, visits: [] as ClinicVisitRow[] };

  const rows = (data ?? []) as unknown as ClinicVisitQueryRow[];
  const visits: ClinicVisitRow[] = rows.map((row) => {
    const student = firstRelation(row.students);
    const faculty = firstRelation(row.faculty);
    const staffProfile = firstRelation(row.staff);
    const consultations = Array.isArray(row.consultations)
      ? row.consultations
      : row.consultations
        ? [row.consultations]
        : [];
    return {
      id: row.id,
      patient_type: row.patient_type,
      patient_name: student
        ? `${student.first_name} ${student.last_name} (${student.student_number})`
        : faculty
          ? `${faculty.first_name} ${faculty.last_name} (${faculty.employee_number})`
          : staffProfile
            ? `${staffProfile.first_name} ${staffProfile.last_name} (${staffProfile.employee_number})`
            : null,
      visit_type: row.visit_type,
      check_in_time: row.check_in_time,
      check_out_time: row.check_out_time,
      status: row.status,
      consultation_count: consultations.length,
    };
  });

  return { error: null, visits };
}

export interface ConsultationDetailRow {
  id: string;
  patient_type: "student" | "faculty" | "staff";
  patient_name: string | null;
  patient_complaint: string | null;
  consultation_notes: string | null;
  vitals_disposition: "not_assessed" | "required" | "not_required" | "recorded";
  vitals_skip_reason: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  doctor_name: string | null;
  nurse_name: string | null;
  triage: {
    temperature: number | null;
    blood_pressure: string | null;
    heart_rate: number | null;
    respiratory_rate: number | null;
    oxygen_saturation: number | null;
    weight: number | null;
    height: number | null;
    symptoms: string | null;
    triage_level: string | null;
    notes: string | null;
  } | null;
  diagnoses: Array<{
    id: string;
    icd10_code: string | null;
    description: string | null;
    is_primary: boolean;
  }>;
  treatments: Array<{
    id: string;
    treatment_plan: string | null;
    instructions: string | null;
    follow_up_days: number | null;
  }>;
  prescriptions: Array<{
    id: string;
    medicine_name: string | null;
    dosage: string | null;
    status: string;
    quantity: number | null;
  }>;
}

type RelatedValue<T> = T | T[] | null;

interface PatientRelation {
  first_name: string;
  last_name: string;
  student_number?: string;
  employee_number?: string;
}

interface DetailVisitRelation {
  patient_type: "student" | "faculty" | "staff";
  students: RelatedValue<PatientRelation>;
  faculty: RelatedValue<PatientRelation>;
  staff: RelatedValue<PatientRelation>;
}

interface PrescriptionQueryRow {
  id: string;
  dosage: string | null;
  status: string;
  quantity: number | null;
  medicines: RelatedValue<{
    generic_name: string;
    brand_name: string | null;
  }>;
}

interface ConsultationDetailQueryRow {
  id: string;
  patient_complaint: string | null;
  consultation_notes: string | null;
  vitals_disposition: ConsultationDetailRow["vitals_disposition"] | null;
  vitals_skip_reason: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  clinic_visits: RelatedValue<DetailVisitRelation>;
  doctor: RelatedValue<{ display_name: string | null }>;
  nurse: RelatedValue<{ display_name: string | null }>;
  triage_assessments: RelatedValue<NonNullable<ConsultationDetailRow["triage"]>>;
  diagnoses: ConsultationDetailRow["diagnoses"] | null;
  treatments: ConsultationDetailRow["treatments"] | null;
  prescriptions: PrescriptionQueryRow[] | null;
}

// Returns one consultation after enforcing clinician assignment server-side.
export async function getConsultationDetailAction(
  consultationId: string,
): Promise<{
  error: string | null;
  consultation: ConsultationDetailRow | null;
}> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", consultation: null };

  const admin = createAdminClient();
  let assignedId: string | null = null;
  if (actor.role !== "admin") {
    const { data: account } = await admin
      .from("clinic_accounts")
      .select("id")
      .eq("user_id", actor.id)
      .eq("is_active", true)
      .maybeSingle();
    assignedId = account?.id ?? null;
    if (!assignedId) return { error: "Active clinic account not found", consultation: null };
  }

  let query = admin
    .from("consultations")
    .select(
      `
      id,
      visit_id,
      clinic_visits(
        patient_type,
        students(first_name, last_name, student_number),
        faculty(first_name, last_name, employee_number),
        staff(first_name, last_name, employee_number)
      ),
      doctor:clinic_accounts!consultations_doctor_id_fkey(display_name),
      nurse:clinic_accounts!consultations_nurse_id_fkey(display_name),
      patient_complaint,
      consultation_notes,
      vitals_disposition,
      vitals_skip_reason,
      status,
      created_at,
      completed_at,
      triage_assessments(
        temperature, blood_pressure, heart_rate, respiratory_rate, oxygen_saturation, weight, height, symptoms, triage_level, notes
      ),
      diagnoses(id, icd10_code, description, is_primary),
      treatments(id, treatment_plan, instructions, follow_up_days),
      prescriptions(
        id, dosage, status, quantity,
        medicines(generic_name, brand_name)
      )
    `,
    )
    .eq("id", consultationId);

  if (assignedId) query = query.or(`doctor_id.eq.${assignedId},nurse_id.eq.${assignedId}`);
  const { data, error } = await query.maybeSingle();

  if (error) return { error: error.message, consultation: null };
  if (!data) return { error: null, consultation: null };

  const detail = data as unknown as ConsultationDetailQueryRow;
  const visit = firstRelation(detail.clinic_visits);
  const student = firstRelation(visit?.students);
  const faculty = firstRelation(visit?.faculty);
  const staffProfile = firstRelation(visit?.staff);
  const doctor = firstRelation(detail.doctor);
  const nurse = firstRelation(detail.nurse);
  const triageRaw = firstRelation(detail.triage_assessments);

  const consultation: ConsultationDetailRow = {
    id: detail.id,
    patient_type: visit?.patient_type ?? "student",
    patient_name: student
      ? `${student.first_name} ${student.last_name} (${student.student_number})`
      : faculty
        ? `${faculty.first_name} ${faculty.last_name} (${faculty.employee_number})`
        : staffProfile
          ? `${staffProfile.first_name} ${staffProfile.last_name} (${staffProfile.employee_number})`
        : null,
    patient_complaint: detail.patient_complaint,
    consultation_notes: detail.consultation_notes,
    vitals_disposition: detail.vitals_disposition ?? "not_assessed",
    vitals_skip_reason: detail.vitals_skip_reason ?? null,
    status: detail.status,
    created_at: detail.created_at,
    completed_at: detail.completed_at,
    doctor_name: doctor?.display_name ?? null,
    nurse_name: nurse?.display_name ?? null,
    triage: triageRaw
      ? {
          temperature: triageRaw.temperature,
          blood_pressure: triageRaw.blood_pressure,
          heart_rate: triageRaw.heart_rate,
          respiratory_rate: triageRaw.respiratory_rate,
          oxygen_saturation: triageRaw.oxygen_saturation,
          weight: triageRaw.weight,
          height: triageRaw.height,
          symptoms: triageRaw.symptoms,
          triage_level: triageRaw.triage_level,
          notes: triageRaw.notes,
        }
      : null,
    diagnoses: (detail.diagnoses ?? []).map((diagnosis) => ({
      id: diagnosis.id,
      icd10_code: diagnosis.icd10_code,
      description: diagnosis.description,
      is_primary: diagnosis.is_primary,
    })),
    treatments: (detail.treatments ?? []).map((treatment) => ({
      id: treatment.id,
      treatment_plan: treatment.treatment_plan,
      instructions: treatment.instructions,
      follow_up_days: treatment.follow_up_days,
    })),
    prescriptions: (detail.prescriptions ?? []).map((prescription) => {
      const medicine = firstRelation(prescription.medicines);
      return {
        id: prescription.id,
        medicine_name: medicine
          ? `${medicine.generic_name}${medicine.brand_name ? ` (${medicine.brand_name})` : ""}`
          : null,
        dosage: prescription.dosage,
        status: prescription.status,
        quantity: prescription.quantity,
      };
    }),
  };

  return { error: null, consultation };
}

// Keeps the legacy notes endpoint read-only because final review owns outcome notes.
export async function updateConsultationNotesAction(
  consultationId: string,
  notes: string,
): Promise<{ error: string | null }> {
  void consultationId;
  void notes;
  return { error: "Outcome notes are saved from the final consultation review." };
}

// Normalizes Supabase to-one relationships returned as an object or an array.
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
