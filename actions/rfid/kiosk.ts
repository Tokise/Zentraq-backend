"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth/get-user-role";
import { logAuditEvent } from "@/lib/audit-logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getServerlessFeatureStatus,
  isServerlessFeatureEnabled,
} from "@/lib/serverless/feature-flags";
import { assertSameOrigin } from "@/lib/security/action-guard";
import { resolveProfilePhotoUrl } from "@/lib/storage/profile-photos";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const { data: clinicAccount } = await createAdminClient()
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", role)
    .eq("is_active", true)
    .maybeSingle();
  if (!clinicAccount) {
    return { error: "Access Denied", user: null, role: null };
  }
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

export interface RfidServerlessDiagnostic {
  globallyEnabled: boolean;
  canaryRestricted: boolean;
  enabledForCurrentOperator: boolean;
  lastExecutionPath: "edge" | "legacy" | null;
  lastExecutedAt: string | null;
}

// Returns sanitized RFID rollout and last-path diagnostics to an Admin only.
export async function getRfidServerlessDiagnosticAction(): Promise<{
  error: string | null;
  diagnostic: RfidServerlessDiagnostic | null;
}> {
  const auth = await requireClinicStaff();
  if (auth.error || !auth.user || auth.role !== "admin") {
    return { error: "Access denied", diagnostic: null };
  }

  const rollout = getServerlessFeatureStatus("rfid", auth.user.id);
  const { data } = await createAdminClient()
    .from("audit_logs")
    .select("metadata,created_at")
    .eq("user_id", auth.user.id)
    .eq("action", "RFID_SCAN")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const metadata = data?.metadata as Record<string, unknown> | null;
  const executionPath = metadata?.executionPath;

  return {
    error: null,
    diagnostic: {
      globallyEnabled: rollout.globallyEnabled,
      canaryRestricted: rollout.canaryRestricted,
      enabledForCurrentOperator: rollout.enabledForUser,
      lastExecutionPath:
        executionPath === "edge" || executionPath === "legacy"
          ? executionPath
          : null,
      lastExecutedAt: data?.created_at ?? null,
    },
  };
}

export interface RfidQueueItem {
  id: string;
  consultationId: string;
  patientId: string;
  patientName: string;
  patientType: "student" | "faculty" | "staff";
  checkedInAt: string;
  status: "waiting" | "claimed" | "awaiting_doctor_review";
  priority: number;
  profilePhotoUrl: string | null;
  claimedByName: string | null;
  claimedByCurrentUser: boolean;
  canStartConsultation: boolean;
}

type QueuePatientRow = {
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_photo_url: string | null;
};

type QueueVisitRow = {
  patient_type: "student" | "faculty" | "staff";
  student_id: string | null;
  faculty_id: string | null;
  staff_id: string | null;
  consultations:
    | { id: string; review_doctor_id: string | null }
    | Array<{ id: string; review_doctor_id: string | null }>
    | null;
  students: QueuePatientRow | QueuePatientRow[] | null;
  faculty: QueuePatientRow | QueuePatientRow[] | null;
  staff: QueuePatientRow | QueuePatientRow[] | null;
};

type QueueQueryRow = {
  id: string;
  status: RfidQueueItem["status"];
  priority: number;
  created_at: string;
  claimed_by: string | null;
  clinic_visits: QueueVisitRow | QueueVisitRow[] | null;
};

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

// Returns the current clinical worklist ordered by priority and arrival time.
export async function getRfidQueue(): Promise<{
  error: string | null;
  queue: RfidQueueItem[];
}> {
  const auth = await requireClinicStaff();
  if (auth.error || !auth.user) return { error: auth.error, queue: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clinic_queue_entries")
    .select(
      "id, status, priority, created_at, claimed_by, clinic_visits(patient_type, student_id, faculty_id, staff_id, consultations(id, review_doctor_id), students(user_id, first_name, last_name, profile_photo_url), faculty(user_id, first_name, last_name, profile_photo_url), staff(user_id, first_name, last_name, profile_photo_url))",
    )
    .in("status", ["waiting", "claimed", "awaiting_doctor_review"])
    .or(`claimed_by.is.null,claimed_by.eq.${auth.user.id}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return { error: "Unable to load the clinic queue", queue: [] };

  const { data: account } = await admin
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!account) {
    return { error: "Active clinic account not found", queue: [] };
  }

  const { data: duty } = await admin
    .from("clinician_duty_status")
    .select("is_on_duty,expires_at")
    .eq("clinic_account_id", account.id)
    .maybeSingle();
  const isOnDuty = Boolean(
    duty?.is_on_duty &&
      duty.expires_at &&
      new Date(duty.expires_at).getTime() > Date.now(),
  );

  const rows = (data ?? []) as unknown as QueueQueryRow[];
  const claimantUserIds = Array.from(
    new Set(
      rows
        .map((item) => item.claimed_by)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
  const claimantNames = new Map<string, string>();

  if (claimantUserIds.length > 0) {
    const { data: claimantAccounts } = await admin
      .from("clinic_accounts")
      .select("user_id, display_name")
      .in("user_id", claimantUserIds)
      .eq("is_active", true);

    for (const claimant of claimantAccounts ?? []) {
      if (claimant.user_id && claimant.display_name) {
        claimantNames.set(claimant.user_id, claimant.display_name);
      }
    }
  }

  const queue = rows
    .filter((item) =>
      canAccessQueueItem(
        item,
        auth.user.id,
        auth.role,
        account.id,
        isOnDuty,
      ),
    )
    .flatMap((item): RfidQueueItem[] => {
      const visit = firstRelation(item.clinic_visits);
      const patient = visit?.patient_type === "student"
        ? firstRelation(visit.students)
        : visit?.patient_type === "faculty"
          ? firstRelation(visit.faculty)
          : firstRelation(visit?.staff ?? null);
      const consultation = firstRelation(visit?.consultations ?? null);
      if (patient?.user_id === auth.user.id) return [];
      return [{
        id: item.id,
        consultationId: consultation?.id ?? "",
        patientId: (
          visit?.patient_type === "student"
            ? visit?.student_id
            : visit?.patient_type === "faculty"
              ? visit?.faculty_id
              : visit?.staff_id
        ) ?? "",
        patientName:
          `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() ||
          "Unknown patient",
        patientType: visit?.patient_type ?? "student",
        checkedInAt: item.created_at,
        status: item.status,
        priority: item.priority,
        profilePhotoUrl: patient?.profile_photo_url ?? null,
        claimedByName: item.claimed_by
          ? (claimantNames.get(item.claimed_by) ?? null)
          : null,
        claimedByCurrentUser: item.claimed_by === auth.user.id,
        canStartConsultation: canAccessQueueItem(
          item,
          auth.user.id,
          auth.role,
          account.id,
          isOnDuty,
        ),
      }];
    })
    .filter((item) => Boolean(item.patientId && item.consultationId));

  const queueWithSignedPhotos = await Promise.all(
    queue.map(async (item) => ({
      ...item,
      profilePhotoUrl: await resolveProfilePhotoUrl(
        admin,
        item.profilePhotoUrl,
      ),
    })),
  );

  return {
    error: null,
    queue: queueWithSignedPhotos,
  };
}

// Allows unclaimed eligible work or work already claimed by the current operator.
function canAccessQueueItem(
  item: QueueQueryRow,
  userId: string,
  role: "admin" | "doctor" | "nurse",
  clinicAccountId: string,
  isOnDuty: boolean,
): boolean {
  if (item.claimed_by === userId) return true;
  if (item.claimed_by) return false;
  if (item.status === "waiting") return true;
  if (item.status !== "awaiting_doctor_review" || role !== "doctor") {
    return false;
  }

  const consultation = firstRelation(
    firstRelation(item.clinic_visits)?.consultations ?? null,
  );
  return consultation?.review_doctor_id
    ? consultation.review_doctor_id === clinicAccountId
    : isOnDuty;
}

// Atomically queues an RFID patient or returns their existing active check-in.
export async function checkInRfid(
  rfidUid: string,
  eventId?: string,
): Promise<{ error: string | null; result: RfidCheckInResult | null }> {
  const auth = await requireClinicStaff();
  if (auth.error || !auth.user) return { error: auth.error, result: null };
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin", result: null };
  }

  const uid = rfidUid.trim();
  if (uid.length < 4 || uid.length > 64 || /[\u0000-\u001F\u007F]/.test(uid)) {
    return { error: "Invalid RFID UID format", result: null };
  }

  const rate = checkRateLimit(`rfid-check-in:${auth.user.id}`, 90, 60 * 1000);
  if (!rate.success) {
    return { error: "Too many check-in attempts. Try again shortly.", result: null };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const requestEventId = eventId?.trim() || crypto.randomUUID();
  if (!UUID_PATTERN.test(requestEventId)) {
    return { error: "Invalid check-in request", result: null };
  }

  if (isServerlessFeatureEnabled("rfid", auth.user.id)) {
    const { data, error } = await supabase.functions.invoke("rfid-check-in", {
      body: { eventId: requestEventId, rfidUid: uid },
    });
    const result = data?.result as RfidCheckInResult | undefined;
    if (error || !result) {
      return { error: "Unable to check in this card", result: null };
    }
    result.clinicPhotoUrl = await resolveProfilePhotoUrl(
      createAdminClient(),
      result.clinicPhotoUrl,
    );
    await logRfidExecution(
      auth.user.id,
      auth.user.email ?? null,
      requestEventId,
      "edge",
      result,
    );
    return { error: null, result };
  }

  const { data, error } = await supabase.rpc("check_in_rfid", {
    p_rfid_uid: uid,
  });

  if (error || !data?.[0]) {
    return {
      error: "Unable to check in this card",
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
    clinicPhotoUrl: await resolveProfilePhotoUrl(
      createAdminClient(),
      profile?.profile_photo_url ?? item.clinic_photo_url ?? null,
    ),
    createdNew: item.created_new,
  };

  await logRfidExecution(
    auth.user.id,
    auth.user.email ?? null,
    requestEventId,
    "legacy",
    result,
  );

  return { error: null, result };
}

// Writes a PHI-free audit record for either RFID execution path.
async function logRfidExecution(
  userId: string,
  email: string | null,
  eventId: string,
  executionPath: "edge" | "legacy",
  result: RfidCheckInResult,
) {
  await logAuditEvent({
    action: "RFID_SCAN",
    userId,
    email,
    resource: result.queueEntryId,
    details: {
      eventId,
      executionPath,
      resultStatus: "success",
      createdNew: result.createdNew,
      patientType: result.patientType,
    },
  });
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
function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Converts an unknown exception into a safe user-facing message.
