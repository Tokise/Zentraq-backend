"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { getRfidRolloutStatus } from "@/lib/serverless/rfid-rollout";
import { resolveProfilePhotoUrl } from "@/lib/storage/profile-photos";
import { firstRelation, requireClinicStaff } from "@/actions/rfid/shared";

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

  const rollout = getRfidRolloutStatus(auth.user.id);
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

// Returns the current clinical worklist ordered by priority and arrival time.
export async function getRfidQueueAction(): Promise<{
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
