"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth/get-user-role";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit-logger";

async function requireClinicStaff() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated", user: null, role: null };
  const role = await getUserRole(user.id);
  if (!role || !["admin", "doctor", "nurse"].includes(role))
    return { error: "Access Denied", user: null, role: null };
  return { error: null, user, role: role as "admin" | "doctor" | "nurse" };
}

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

export interface RfidCheckInResult {
  queueEntryId: string;
  consultationId: string;
  patientType: "student" | "faculty" | "staff";
  patientId: string;
  firstName: string;
  lastName: string;
  clinicPhotoUrl: string | null;
  createdNew: boolean;
}

export interface RfidQueueItem {
  id: string;
  consultationId: string;
  patientId: string;
  patientName: string;
  patientType: "student" | "faculty" | "staff";
  checkedInAt: string;
  status: "waiting" | "claimed";
  priority: number;
  profilePhotoUrl: string | null;
}

// Returns the current clinical worklist ordered by priority and arrival time.
export async function getRfidQueue(): Promise<{
  error: string | null;
  queue: RfidQueueItem[];
}> {
  const auth = await requireClinicStaff();
  if (auth.error || !auth.user) return { error: auth.error, queue: [] };

  const { data, error } = await createAdminClient()
    .from("clinic_queue_entries")
    .select(
      "id, status, priority, created_at, clinic_visits(patient_type, student_id, faculty_id, staff_id, consultations(id, doctor_id, nurse_id), students(first_name, last_name, profile_photo_url), faculty(first_name, last_name, profile_photo_url), staff(first_name, last_name, profile_photo_url))",
    )
    .in("status", ["waiting", "claimed"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, queue: [] };

  let assignedClinicianId: string | null = null;
  if (auth.role !== "admin") {
    const { data: account } = await createAdminClient()
      .from("clinic_accounts")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .maybeSingle();
    assignedClinicianId = account?.id ?? null;
    if (!assignedClinicianId) {
      return { error: "Active clinic account not found", queue: [] };
    }
  }

  const queue = (data ?? [])
    .filter((item: any) => {
      if (!assignedClinicianId) return true;
      const visit = Array.isArray(item.clinic_visits)
        ? item.clinic_visits[0]
        : item.clinic_visits;
      const consultations = Array.isArray(visit?.consultations)
        ? visit.consultations
        : [];
      return consultations.some(
        (consultation: { doctor_id: string | null; nurse_id: string | null }) =>
          consultation.doctor_id === assignedClinicianId ||
          consultation.nurse_id === assignedClinicianId,
      );
    })
    .map((item: any) => {
      const visit = Array.isArray(item.clinic_visits)
        ? item.clinic_visits[0]
        : item.clinic_visits;
      const patient = visit?.patient_type === "student"
        ? (Array.isArray(visit.students) ? visit.students[0] : visit.students)
        : visit?.patient_type === "faculty"
          ? (Array.isArray(visit.faculty) ? visit.faculty[0] : visit.faculty)
          : (Array.isArray(visit.staff) ? visit.staff[0] : visit.staff);
      const consultation = Array.isArray(visit?.consultations)
        ? visit.consultations[0]
        : visit?.consultations;
      return {
        id: item.id,
        consultationId: consultation?.id ?? "",
        patientId:
          visit?.patient_type === "student"
            ? visit?.student_id
            : visit?.patient_type === "faculty"
              ? visit?.faculty_id
              : visit?.staff_id,
        patientName:
          `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() ||
          "Unknown patient",
        patientType: visit?.patient_type ?? "student",
        checkedInAt: item.created_at,
        status: item.status,
        priority: item.priority,
        profilePhotoUrl: patient?.profile_photo_url ?? null,
      };
    });

  return {
    error: null,
    queue,
  };
}

// Atomically queues an RFID patient or returns their existing active check-in.
export async function checkInRfid(
  rfidUid: string,
): Promise<{ error: string | null; result: RfidCheckInResult | null }> {
  const auth = await requireClinicStaff();
  if (auth.error || !auth.user) return { error: auth.error, result: null };

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.rpc("check_in_rfid", {
    p_rfid_uid: rfidUid.trim(),
  });

  if (error || !data?.[0]) {
    return {
      error: error?.message || "Unable to check in patient",
      result: null,
    };
  }

  const item = data[0];
  const { data: profile } = await createAdminClient()
    .from("v_rfid_patient_profiles")
    .select("profile_photo_url")
    .eq("patient_type", item.patient_type)
    .eq("patient_id", item.patient_id)
    .maybeSingle();
  const result: RfidCheckInResult = {
    queueEntryId: item.queue_entry_id,
    consultationId: item.consultation_id,
    patientType: item.patient_type,
    patientId: item.patient_id,
    firstName: item.first_name,
    lastName: item.last_name,
    clinicPhotoUrl: profile?.profile_photo_url ?? item.clinic_photo_url ?? null,
    createdNew: item.created_new,
  };

  await logAuditEvent({
    action: "RFID_SCAN",
    userId: auth.user.id,
    email: auth.user.email,
    resource: result.queueEntryId,
    details: { createdNew: result.createdNew, patientType: result.patientType },
  });

  return { error: null, result };
}

/**
 * Server Action: Look up a patient profile by RFID UID for the kiosk.
 * Uses Service Role via createAdminClient() — NEVER exposes full student records.
 * Requires clinic staff authentication.
 */
export async function getKioskStudentProfile(rfidUid: string) {
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
      console.error("[getKioskStudentProfile DB Error]:", error);
      return { error: error.message, profile: null };
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
      clinicPhotoUrl: data.profile_photo_url || null,
    };

    return { error: null, profile };
  } catch (err: any) {
    console.error("[getKioskStudentProfile Exception]:", err);
    return {
      error: err?.message || "Failed to look up student",
      profile: null,
    };
  }
}

export async function createConsultation(
  profileId: string,
  patientName: string,
  complaint: string,
) {
  try {
    const auth = await requireClinicStaff();
    if (auth.error || !auth.user) return { error: auth.error };
    const admin = createAdminClient();
    const { data: visit, error: visitError } = await admin
      .from("clinic_visits")
      .insert({
        patient_type: "student",
        student_id: profileId,
        visit_type: "rfid",
        created_by: auth.user.id,
      })
      .select("id")
      .single();
    if (visitError || !visit)
      return { error: visitError?.message || "Unable to create clinic visit" };
    const { data: account } = await admin
      .from("clinic_accounts")
      .select("id, role")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    const { data, error } = await admin
      .from("consultations")
      .insert({
        visit_id: visit.id,
        chief_complaint: complaint,
        doctor_id: account?.role === "doctor" ? account.id : null,
        nurse_id: account?.role === "nurse" ? account.id : null,
        status: "in-progress",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    await logAuditEvent({
      action: "RFID_SCAN",
      userId: auth.user.id,
      email: auth.user.email,
      resource: data?.id,
      details: { patientName, complaint },
    });
    revalidatePath("/consultations");
    return { success: true, data };
  } catch (err: any) {
    return { error: err?.message || "Server error" };
  }
}

export interface KioskConsultationSummary {
  id: string;
  checkedInAt: string;
  visitType: string;
  complaint: string | null;
  status: string | null;
  notes: string | null;
}

/** Returns past consultation summaries for a patient across all patient roles. */
export async function getPatientConsultationHistory(
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
      "id, check_in_time, visit_type, consultations(id, chief_complaint, consultation_notes, status)",
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

  const consultations = (data ?? []).flatMap((visit: any) => {
    const entries = Array.isArray(visit.consultations)
      ? visit.consultations
      : [];
    return entries.map((consultation: any) => ({
      id: consultation.id,
      checkedInAt: visit.check_in_time,
      visitType: visit.visit_type,
      complaint: consultation.chief_complaint ?? null,
      status: consultation.status ?? null,
      notes: consultation.consultation_notes ?? null,
    }));
  });

  return {
    error: null,
    consultations: consultations as KioskConsultationSummary[],
  };
}
