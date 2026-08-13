"use server";

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

type StaffRole = "admin" | "doctor" | "nurse";
async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

export interface QueueAppointment {
  id: string;
  patient_name: string;
  reason: string;
  priority: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
}
export async function getAppointmentQueueAction(statuses?: string[]) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor)
    return { error: "Access denied", appointments: [] as QueueAppointment[] };
  let query = createAdminClient()
    .from("v_appointment_overview")
    .select(
      "id, patient_first_name, patient_last_name, scheduled_date, scheduled_time, priority, status",
    )
    .order("scheduled_date", { ascending: true })
    .limit(100);
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error)
    return { error: error.message, appointments: [] as QueueAppointment[] };
  const ids = (data ?? []).map((item) => item.id);
  const { data: details } = ids.length
    ? await createAdminClient()
        .from("appointments")
        .select("id, reason")
        .in("id", ids)
    : { data: [] as Array<{ id: string; reason: string }> };
  const reasons = new Map(
    (details ?? []).map((item) => [item.id, item.reason]),
  );
  return {
    error: null,
    appointments: (data ?? []).map((item) => ({
      id: item.id,
      patient_name:
        `${item.patient_first_name} ${item.patient_last_name}`.trim(),
      reason: reasons.get(item.id) ?? "",
      priority: item.priority,
      scheduled_date: item.scheduled_date,
      scheduled_time: item.scheduled_time,
      status: item.status,
    })),
  };
}

export interface QueueConsultation {
  id: string;
  patient_name: string;
  patient_complaint: string;
  status: string;
  check_in_time: string;
  doctor_name: string | null;
  claimed_by_name: string | null;
  claimed_by_role: StaffRole | null;
}

type RelatedValue<T> = T | T[] | null;

interface QueueVisitRelation {
  patient_type: "student" | "faculty" | "staff";
  check_in_time: string;
  students: RelatedValue<{ first_name: string; last_name: string }>;
  faculty: RelatedValue<{ first_name: string; last_name: string }>;
  staff: RelatedValue<{ first_name: string; last_name: string }>;
}

interface QueueConsultationQueryRow {
  id: string;
  patient_complaint: string | null;
  status: string;
  created_at: string;
  doctor: RelatedValue<{ display_name: string | null }>;
  claimant: RelatedValue<{
    display_name: string | null;
    role: StaffRole | null;
  }>;
  clinic_visits: RelatedValue<QueueVisitRelation>;
}

const CLAIMED_CONSULTATION_STATUSES = new Set(["in-progress", "completed"]);

// Returns consultations currently or previously owned by the active clinic account.
export async function getConsultationQueueAction(statuses?: string[]) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor)
    return { error: "Access denied", consultations: [] as QueueConsultation[] };
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", actor.id)
    .eq("role", actor.role)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) {
    return {
      error: "Active clinic account not found",
      consultations: [] as QueueConsultation[],
    };
  }

  const requestedStatuses = statuses
    ? Array.from(
        new Set(
          statuses.filter((status) =>
            CLAIMED_CONSULTATION_STATUSES.has(status),
          ),
        ),
      )
    : Array.from(CLAIMED_CONSULTATION_STATUSES);

  if (requestedStatuses.length === 0) {
    return { error: null, consultations: [] as QueueConsultation[] };
  }

  const query = admin
    .from("consultations")
    .select(
      `
      id,
      patient_complaint,
      status,
      created_at,
      doctor:clinic_accounts!consultations_doctor_id_fkey(display_name),
      claimant:clinic_accounts!consultations_claimed_by_clinic_account_id_fkey(
        display_name,
        role
      ),
      clinic_visits(
        patient_type,
        check_in_time,
        students(first_name, last_name),
        faculty(first_name, last_name),
        staff(first_name, last_name)
      )
    `,
    )
    .eq("claimed_by_user_id", actor.id)
    .eq("claimed_by_clinic_account_id", account.id)
    .in("status", requestedStatuses)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as QueueConsultationQueryRow[];
  return {
    error: error?.message ?? null,
    consultations: rows.map((item) => {
      const visit = firstRelation(item.clinic_visits);
      const patient =
        visit?.patient_type === "student"
          ? firstRelation(visit.students)
          : visit?.patient_type === "faculty"
            ? firstRelation(visit.faculty)
            : firstRelation(visit?.staff);
      const doctor = firstRelation(item.doctor);
      const claimant = firstRelation(item.claimant);
      return {
        id: item.id,
        patient_name:
          `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() ||
          "Unknown patient",
        patient_complaint: item.patient_complaint ?? "",
        status: item.status,
        check_in_time: visit?.check_in_time ?? item.created_at,
        doctor_name: doctor?.display_name ?? null,
        claimed_by_name: claimant?.display_name ?? null,
        claimed_by_role: claimant?.role ?? null,
      };
    }),
  };
}

// Returns faculty and staff consultations for the dedicated Staff Health module.
export async function getStaffHealthConsultationsAction() {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor)
    return { error: "Access denied", consultations: [] as QueueConsultation[] };
  const { data, error } = await createAdminClient()
    .from("v_consultation_summary")
    .select(
      "consultation_id, patient_first_name, patient_last_name, patient_complaint, consultation_status, check_in_time, doctor_name",
    )
    .in("patient_type", ["faculty", "staff"])
    .order("check_in_time", { ascending: false })
    .limit(100);
  return {
    error: error?.message ?? null,
    consultations: (data ?? []).map((item) => ({
      id: item.consultation_id,
      patient_name:
        `${item.patient_first_name} ${item.patient_last_name}`.trim(),
      patient_complaint: item.patient_complaint ?? "",
      status: item.consultation_status,
      check_in_time: item.check_in_time,
      doctor_name: item.doctor_name,
    })),
  };
}

export async function getIncidentQueueAction(includeClosed = false) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor)
    return {
      error: "Access denied",
      incidents: [] as Array<{
        id: string;
        description: string;
        severity: string | null;
        status: string;
        created_at: string;
      }>,
    };
  let query = createAdminClient()
    .from("incidents")
    .select("id, description, severity, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!includeClosed) query = query.neq("status", "closed");
  const { data, error } = await query;
  return { error: error?.message ?? null, incidents: data ?? [] };
}

export async function getClearanceQueueAction() {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor)
    return {
      error: "Access denied",
      clearances: [] as Array<{
        id: string;
        requester_type: string;
        purpose: string | null;
        status: string;
        created_at: string;
      }>,
    };
  const { data, error } = await createAdminClient()
    .from("health_clearances")
    .select("id, requester_type, purpose, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return { error: error?.message ?? null, clearances: data ?? [] };
}

// Normalizes Supabase to-one relationships returned as an object or an array.
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
