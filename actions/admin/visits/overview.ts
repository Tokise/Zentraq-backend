"use server";

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

type StaffRole = "admin" | "doctor" | "nurse";

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

export interface ClinicVisitRow {
  id: string;
  patient_type: "student" | "faculty";
  patient_name: string | null;
  visit_type: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  consultation_count: number;
}

export async function getClinicVisitsAction(params?: {
  status?: string;
  searchQuery?: string;
}): Promise<{ error: string | null; visits: ClinicVisitRow[] }> {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", visits: [] as ClinicVisitRow[] };

  const admin = createAdminClient();
  let query = admin
    .from("clinic_visits")
    .select(
      `
      id, patient_type, visit_type, check_in_time, check_out_time, status,
      students(first_name, last_name, student_number),
      faculty(first_name, last_name, employee_number),
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

  const visits: ClinicVisitRow[] = (data ?? []).map((row: any) => {
    const student = Array.isArray(row.students)
      ? row.students[0]
      : row.students;
    const faculty = Array.isArray(row.faculty) ? row.faculty[0] : row.faculty;
    const consultations = Array.isArray(row.consultations)
      ? row.consultations
      : [];
    return {
      id: row.id,
      patient_type: row.patient_type,
      patient_name: student
        ? `${student.first_name} ${student.last_name} (${student.student_number})`
        : faculty
          ? `${faculty.first_name} ${faculty.last_name} (${faculty.employee_number})`
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
  chief_complaint: string | null;
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
      chief_complaint,
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

  const visit: any = Array.isArray(data.clinic_visits)
    ? data.clinic_visits[0]
    : data.clinic_visits;
  const student =
    visit &&
    (Array.isArray(visit.students) ? visit.students[0] : visit.students);
  const faculty =
    visit && (Array.isArray(visit.faculty) ? visit.faculty[0] : visit.faculty);
  const staffProfile =
    visit && (Array.isArray(visit.staff) ? visit.staff[0] : visit.staff);
  const doctor: any = Array.isArray(data.doctor) ? data.doctor[0] : data.doctor;
  const nurse: any = Array.isArray(data.nurse) ? data.nurse[0] : data.nurse;
  const triageRaw: any = Array.isArray(data.triage_assessments)
    ? data.triage_assessments[0]
    : data.triage_assessments;

  const consultation: ConsultationDetailRow = {
    id: data.id,
    patient_type: visit?.patient_type ?? "student",
    patient_name: student
      ? `${student.first_name} ${student.last_name} (${student.student_number})`
      : faculty
        ? `${faculty.first_name} ${faculty.last_name} (${faculty.employee_number})`
        : staffProfile
          ? `${staffProfile.first_name} ${staffProfile.last_name} (${staffProfile.employee_number})`
        : null,
    chief_complaint: data.chief_complaint,
    consultation_notes: data.consultation_notes,
    vitals_disposition: data.vitals_disposition ?? "not_assessed",
    vitals_skip_reason: data.vitals_skip_reason ?? null,
    status: data.status,
    created_at: data.created_at,
    completed_at: data.completed_at,
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
    diagnoses: (data.diagnoses ?? []).map((d: any) => ({
      id: d.id,
      icd10_code: d.icd10_code,
      description: d.description,
      is_primary: d.is_primary,
    })),
    treatments: (data.treatments ?? []).map((t: any) => ({
      id: t.id,
      treatment_plan: t.treatment_plan,
      instructions: t.instructions,
      follow_up_days: t.follow_up_days,
    })),
    prescriptions: (data.prescriptions ?? []).map((p: any) => {
      const medicine = Array.isArray(p.medicines)
        ? p.medicines[0]
        : p.medicines;
      return {
        id: p.id,
        medicine_name: medicine
          ? `${medicine.generic_name}${medicine.brand_name ? ` (${medicine.brand_name})` : ""}`
          : null,
        dosage: p.dosage,
        status: p.status,
        quantity: p.quantity,
      };
    }),
  };

  return { error: null, consultation };
}

export async function updateConsultationNotesAction(
  consultationId: string,
  notes: string,
): Promise<{ error: string | null }> {
  void consultationId;
  void notes;
  return { error: "Outcome notes are saved from the final consultation review." };
}
