"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { getActionActor, hasAnyRole } from "@/lib/security/action-guard";

export interface DashboardConsultationDTO {
  id: string;
  patient_name: string;
  student_complaint: string;
  status: string;
  created_at: string;
  handled_at: string | null;
  notes: string | null;
}
export interface DashboardAppointmentDTO {
  id: string;
  appointment_date: string;
  time_slot: string;
  reason: string | null;
  status: string;
  patient_name: string | null;
  student_number: string | null;
  employee_number: string | null;
  department: string | null;
}
export interface DashboardStatsDTO {
  patientsToday: number;
  consultations: number;
  emergencyCases: number;
}
export interface DashboardDataDTO {
  consultations: DashboardConsultationDTO[];
  appointments: DashboardAppointmentDTO[];
  stats: DashboardStatsDTO;
}

export async function getDashboardDataAction() {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"]))
    return { error: "Access denied", data: null };
  const admin = createAdminClient();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const [
    { data: consultations, error: consultationError },
    { data: appointments, error: appointmentError },
    visits,
    incidents,
  ] = await Promise.all([
    admin
      .from("v_consultation_summary")
      .select(
        "consultation_id, patient_first_name, patient_last_name, chief_complaint, consultation_status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("v_appointment_overview")
      .select(
        "id, patient_type, patient_first_name, patient_last_name, scheduled_date, scheduled_time, status",
      )
      .order("scheduled_date", { ascending: true })
      .limit(50),
    admin
      .from("clinic_visits")
      .select("id", { count: "exact", head: true })
      .gte("check_in_time", dayStart.toISOString()),
    admin
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in-progress"]),
  ]);
  if (consultationError || appointmentError)
    return {
      error:
        consultationError?.message ??
        appointmentError?.message ??
        "Unable to load dashboard",
      data: null,
    };
  return {
    error: null,
    data: {
      consultations: (consultations ?? []).map((item) => ({
        id: item.consultation_id,
        patient_name:
          `${item.patient_first_name} ${item.patient_last_name}`.trim(),
        student_complaint: item.chief_complaint ?? "",
        status: item.consultation_status,
        created_at: item.created_at,
        handled_at: null,
        notes: null,
      })),
      appointments: (appointments ?? []).map((item) => ({
        id: item.id,
        appointment_date: item.scheduled_date ?? "",
        time_slot: item.scheduled_time ?? "",
        reason: null,
        status: item.status,
        patient_name:
          `${item.patient_first_name} ${item.patient_last_name}`.trim() || null,
        student_number: null,
        employee_number: null,
        department: null,
      })),
      stats: {
        patientsToday: visits.count ?? 0,
        consultations: consultations?.length ?? 0,
        emergencyCases: incidents.count ?? 0,
      },
    } satisfies DashboardDataDTO,
  };
}
