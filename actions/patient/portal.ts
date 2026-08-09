"use server";

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

type PatientRole = "student" | "faculty" | "staff";

type PatientProfile = {
  id: string;
  role: PatientRole;
};

// Resolves the signed-in patient's profile without accepting a client-supplied ID.
async function getPatientProfile(): Promise<
  { error: string; profile: null } | { error: null; profile: PatientProfile }
> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["student", "faculty", "staff"])) {
    return { error: "Access denied", profile: null };
  }

  const table =
    actor.role === "student"
      ? "students"
      : actor.role === "faculty"
        ? "faculty"
        : "staff";
  const { data: profile } = await createAdminClient()
    .from(table)
    .select("id")
    .eq("user_id", actor.id)
    .maybeSingle();

  if (!profile) return { error: "Patient profile not found", profile: null };
  return {
    error: null,
    profile: { id: profile.id, role: actor.role as PatientRole },
  };
}

// Returns only consultations belonging to the signed-in patient.
export async function getMyConsultationsAction() {
  const identity = await getPatientProfile();
  if (identity.error || !identity.profile) {
    return { error: identity.error, consultations: [] };
  }

  const { data, error } = await createAdminClient()
    .from("v_consultation_summary")
    .select(
      "consultation_id, chief_complaint, consultation_status, check_in_time",
    )
    .eq("patient_type", identity.profile.role)
    .eq("patient_id", identity.profile.id)
    .order("check_in_time", { ascending: false })
    .limit(100);

  return {
    error: error?.message ?? null,
    consultations: (data ?? []).map((consultation) => ({
      id: consultation.consultation_id,
      complaint: consultation.chief_complaint ?? "",
      status: consultation.consultation_status,
      check_in_time: consultation.check_in_time,
    })),
  };
}

// Returns only clearance requests belonging to the signed-in patient.
export async function getMyClearancesAction() {
  const identity = await getPatientProfile();
  if (identity.error || !identity.profile) {
    return { error: identity.error, clearances: [] };
  }

  const idColumn = `${identity.profile.role}_id`;
  const { data, error } = await createAdminClient()
    .from("health_clearances")
    .select("id, requester_type, purpose, status, expires_at, created_at")
    .eq("requester_type", identity.profile.role)
    .eq(idColumn, identity.profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return { error: error?.message ?? null, clearances: data ?? [] };
}

// Creates a clearance request for the signed-in patient.
export async function submitMyClearanceRequestAction(purpose: string) {
  const identity = await getPatientProfile();
  if (identity.error || !identity.profile) return { error: identity.error };
  const normalizedPurpose = purpose.trim();
  if (!normalizedPurpose) return { error: "Purpose is required" };

  const idColumn = `${identity.profile.role}_id`;
  const { error } = await createAdminClient()
    .from("health_clearances")
    .insert({
      requester_type: identity.profile.role,
      [idColumn]: identity.profile.id,
      purpose: normalizedPurpose,
      status: "pending",
    });

  return error ? { error: error.message } : { error: null };
}

type ClinicianAvailabilityRow = {
  clinic_account_id: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  clinic_accounts:
    | {
        display_name: string;
        role: "doctor" | "nurse";
      }
    | Array<{
        display_name: string;
        role: "doctor" | "nurse";
      }>;
};

type AppointmentAvailabilityRow = Omit<ClinicianAvailabilityRow, "day_of_week">;

// Returns clinician cards and their recurring weekly schedule without patient data.
export async function getAppointmentCliniciansAction() {
  const identity = await getPatientProfile();
  if (identity.error || !identity.profile) {
    return {
      error: identity.error,
      clinicians: [],
      minBookableDate: clinicTomorrow(),
    };
  }

  const { data, error } = await createAdminClient()
    .from("staff_availability")
    .select(
      "clinic_account_id, day_of_week, start_time, end_time, clinic_accounts!inner(display_name, role)",
    )
    .eq("is_active", true)
    .in("clinic_accounts.role", ["doctor", "nurse"])
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error)
    return {
      error: error.message,
      clinicians: [],
      minBookableDate: clinicTomorrow(),
    };

  const grouped = new Map<
    string,
    {
      id: string;
      name: string;
      role: "doctor" | "nurse";
      weeklyAvailability: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      }>;
    }
  >();
  for (const row of (data ?? []) as ClinicianAvailabilityRow[]) {
    const account = Array.isArray(row.clinic_accounts)
      ? row.clinic_accounts[0]
      : row.clinic_accounts;
    if (!account) continue;
    const clinician = grouped.get(row.clinic_account_id) ?? {
      id: row.clinic_account_id,
      name: account.display_name,
      role: account.role,
      weeklyAvailability: [],
    };
    clinician.weeklyAvailability.push({
      dayOfWeek: row.day_of_week,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    });
    grouped.set(row.clinic_account_id, clinician);
  }

  return {
    error: null,
    clinicians: [...grouped.values()],
    minBookableDate: clinicTomorrow(),
  };
}

// Returns bookable 30-minute slots for one selected clinician and date.
export async function getAppointmentAvailabilityAction(input: {
  clinicianId: string;
  selectedDate: string;
}) {
  const identity = await getPatientProfile();
  if (identity.error || !identity.profile)
    return { error: identity.error, availability: [] };

  const { clinicianId, selectedDate } = input;
  if (
    !/^[0-9a-f-]{36}$/i.test(clinicianId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
  ) {
    return { error: "Select a valid appointment date", availability: [] };
  }

  const date = new Date(`${selectedDate}T00:00:00`);
  if (Number.isNaN(date.getTime()) || selectedDate < clinicTomorrow()) {
    return { error: "Select a future appointment date", availability: [] };
  }

  const admin = createAdminClient();
  const dayOfWeek = date.getDay();
  const [
    { data: clinician },
    { data: availability, error },
    { data: appointments },
    { data: blocks },
  ] = await Promise.all([
    admin
      .from("clinic_accounts")
      .select("id, display_name, role")
      .eq("id", clinicianId)
      .eq("is_active", true)
      .in("role", ["doctor", "nurse"])
      .maybeSingle(),
    admin
      .from("staff_availability")
      .select(
        "clinic_account_id, start_time, end_time, clinic_accounts!inner(display_name, role)",
      )
      .eq("is_active", true)
      .eq("clinic_account_id", clinicianId)
      .eq("day_of_week", dayOfWeek)
      .in("clinic_accounts.role", ["doctor", "nurse"])
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    admin
      .from("appointments")
      .select("doctor_id, scheduled_time")
      .eq("scheduled_date", selectedDate)
      .in("status", ["scheduled", "reminded", "checked_in", "in_consultation"]),
    admin
      .from("clinician_schedule_blocks")
      .select("clinic_account_id, start_time, end_time")
      .eq("blocked_date", selectedDate),
  ]);

  if (error || !clinician)
    return {
      error: error?.message ?? "Clinician is unavailable",
      availability: [],
    };

  const taken = new Set(
    (appointments ?? []).map(
      (item) => `${item.doctor_id}:${item.scheduled_time?.slice(0, 5)}`,
    ),
  );
  const isBlocked = (clinicianId: string, time: string) =>
    (blocks ?? []).some(
      (block) =>
        block.clinic_account_id === clinicianId &&
        time >= block.start_time.slice(0, 5) &&
        time < block.end_time.slice(0, 5),
    );
  const slots = (availability ?? []).flatMap(
    (row: AppointmentAvailabilityRow) => {
      const start = toMinutes(row.start_time);
      const end = toMinutes(row.end_time);
      const account = Array.isArray(row.clinic_accounts)
        ? row.clinic_accounts[0]
        : row.clinic_accounts;
      const result: Array<Record<string, string>> = [];

      for (let minute = start; minute + 30 <= end; minute += 30) {
        const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(
          minute % 60,
        ).padStart(2, "0")}`;
        const hasTakenSlot =
          taken.has(`${row.clinic_account_id}:${time}:00`) ||
          taken.has(`${row.clinic_account_id}:${time}`);

        if (!hasTakenSlot && !isBlocked(row.clinic_account_id, time)) {
          result.push({
            clinician_id: row.clinic_account_id,
            clinician_name: account?.display_name ?? clinician.display_name,
            clinician_role: account?.role ?? clinician.role,
            scheduled_date: selectedDate,
            scheduled_time: time,
          });
        }
      }

      return result;
    },
  );

  return {
    error: null,
    availability: slots,
  };
}

// Returns tomorrow in the clinic timezone rather than the browser or UTC date.
function clinicTomorrow() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const today = new Date(
    `${values.year}-${values.month}-${values.day}T00:00:00`,
  );
  today.setDate(today.getDate() + 1);
  return today.toISOString().slice(0, 10);
}

// Converts a database time string into minutes since midnight.
function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}
