"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { resolveProfilePhotoUrl } from "@/lib/storage/profile-photos";
import { requireClinicStaff } from "@/actions/rfid/shared";

export interface KioskStudentDTO {
  id: string;
  patientType: "student" | "faculty" | "staff";
  firstName: string;
  lastName: string;
  studentNumber: string | null;
  employeeNumber: string | null;
  department: string | null;
  clinicPhotoUrl: string | null;
}

type ConsultationHistoryQueryRow = {
  check_in_time: string;
  visit_type: string;
  consultations:
    | {
        id: string;
        patient_complaint: string | null;
        consultation_notes: string | null;
        status: string | null;
      }
    | Array<{
        id: string;
        patient_complaint: string | null;
        consultation_notes: string | null;
        status: string | null;
      }>
    | null;
};

export async function getKioskStudentProfileAction(rfidUid: string) {
  try {
    // 1. Validate input length/shape before any DB query (defense in depth)
    if (!rfidUid || rfidUid.trim().length < 4 || rfidUid.trim().length > 64) {
      return { error: "Invalid RFID UID format", profile: null };
    }

    // 2. Require a valid authenticated session (kiosk is behind proxy.ts auth)
    const auth = await requireClinicStaff();
    if (auth.error || !auth.user) {
      return { error: auth.error, profile: null };
    }

    // 3. Authorized lookup with only the fields the kiosk UI needs.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("v_rfid_patient_profiles")
      .select(
        "patient_id, patient_type, first_name, last_name, identifier, department, profile_photo_url",
      )
      .eq("rfid_uid", rfidUid.trim())
      .maybeSingle();

    if (error) {
      console.error(JSON.stringify({
        code: error.code ?? "DATABASE_ERROR",
        event: "rfid_profile_lookup_failed",
      }));
      return { error: "Unable to look up this card", profile: null };
    }

    if (!data) {
      // Not found is NOT an error — the kiosk shows the UNREGISTERED state
      return { error: null, profile: null };
    }

    // 4. Return ONLY the fields the kiosk UI renders (data minimization)
    const profile: KioskStudentDTO = {
      id: data.patient_id,
      patientType: data.patient_type,
      firstName: data.first_name || "",
      lastName: data.last_name || "",
      studentNumber: data.patient_type === "student" ? data.identifier || null : null,
      employeeNumber: data.patient_type !== "student" ? data.identifier || null : null,
      department: data.department || null,
      clinicPhotoUrl: await resolveProfilePhotoUrl(
        admin,
        data.profile_photo_url || null,
      ),
    };

    return { error: null, profile };
  } catch {
    console.error(JSON.stringify({
      code: "RFID_PROFILE_LOOKUP_FAILED",
      event: "rfid_profile_lookup_failed",
    }));
    return {
      error: "Unable to look up this card",
      profile: null,
    };
  }
}

export interface KioskConsultationSummary {
  id: string;
  checkedInAt: string;
  visitType: string;
  patient_complaint: string | null;
  status: string | null;
  notes: string | null;
}

/** Returns past consultation summaries for a patient across all patient roles. */
export async function getPatientConsultationHistoryAction(
  patientId: string,
  patientType: "student" | "faculty" | "staff",
) {
  const auth = await requireClinicStaff();
  if (auth.error || !auth.user)
    return {
      error: auth.error,
      consultations: [] as KioskConsultationSummary[],
    };
  if (!patientId)
    return {
      error: "Patient ID is required",
      consultations: [] as KioskConsultationSummary[],
    };

  const admin = createAdminClient();
  const visitsQuery = admin
    .from("clinic_visits")
    .select(
      "id, check_in_time, visit_type, consultations(id, patient_complaint, consultation_notes, status)",
    )
    .order("check_in_time", { ascending: false })
    .limit(10);

  if (patientType === "student") {
    visitsQuery.eq("student_id", patientId);
  } else if (patientType === "faculty") {
    visitsQuery.eq("faculty_id", patientId);
  } else {
    visitsQuery.eq("staff_id", patientId);
  }

  const { data, error } = await visitsQuery;

  if (error)
    return {
      error: error.message,
      consultations: [] as KioskConsultationSummary[],
    };

  const visits = (data ?? []) as unknown as ConsultationHistoryQueryRow[];
  const consultations = visits.flatMap((visit) => {
    const relation = visit.consultations;
    const entries = Array.isArray(relation)
      ? relation
      : relation
        ? [relation]
        : [];
    return entries.map((consultation) => ({
      id: consultation.id,
      checkedInAt: visit.check_in_time,
      visitType: visit.visit_type,
      patient_complaint: consultation.patient_complaint ?? null,
      status: consultation.status ?? null,
      notes: consultation.consultation_notes ?? null,
    }));
  });

  return {
    error: null,
    consultations,
  };
}

// Normalizes a single Supabase relation returned as either an object or array.
