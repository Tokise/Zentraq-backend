"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  CreateAppointmentSchema,
  AppointmentCheckinSchema,
  AppointmentRecommendationSchema,
  AppointmentReviewSchema,
} from "@/lib/validation/schemas";
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";
import { writeAuditLog } from "@/services/audit/audit-service";
import { sendNotification } from "@/services/notifications/notification-service";
import { evaluateAppointmentWithAI } from "@/services/ai/appointment-evaluator";
import type { ActionResult, AppointmentDTO, AppointmentStatus } from "@/types";

const ScheduleSchema = z.object({
  appointment_id: z.string().uuid(),
  scheduled_date: z.string().date(),
  scheduled_time: z.string().time(),
  doctor_id: z.string().uuid().optional(),
});

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["ai_evaluated", "cancelled"],
  ai_evaluated: ["recommended", "cancelled"],
  recommended: ["scheduled", "rejected", "cancelled"],
  approved: ["scheduled", "cancelled"],
  rejected: [],
  scheduled: ["reminded", "checked_in", "cancelled", "no_show"],
  reminded: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_consultation", "cancelled"],
  in_consultation: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function submitAppointmentRequest(
  input: unknown,
): Promise<ActionResult<AppointmentDTO>> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["student", "faculty", "staff"]))
    return forbidden();
  if (!(await assertSameOrigin())) return forbidden("Invalid request origin");
  const rate = checkRateLimit(
    `appointment:${actor.id}`,
    3,
    24 * 60 * 60 * 1000,
  );
  if (!rate.success)
    return {
      success: false,
      error: "Appointment request limit reached",
      code: "RATE_LIMIT",
    };

  const profileTable =
    actor.role === "student"
      ? "students"
      : actor.role === "faculty"
        ? "faculty"
        : "staff";
  const profileIdField =
    actor.role === "student"
      ? "student_id"
      : actor.role === "faculty"
        ? "faculty_id"
        : "staff_id";
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from(profileTable)
    .select("id")
    .eq("user_id", actor.id)
    .maybeSingle();
  if (!profile)
    return {
      success: false,
      error: "Patient profile not found",
      code: "NOT_FOUND",
    };

  const candidate = isObject(input)
    ? { ...input, patient_type: actor.role, [profileIdField]: profile.id }
    : input;
  const parsed = CreateAppointmentSchema.safeParse(candidate);
  if (!parsed.success)
    return {
      success: false,
      error: "Invalid appointment request",
      code: "VALIDATION",
    };

  if (parsed.data.scheduled_date < clinicTomorrow()) {
    return {
      success: false,
      error: "Appointments must be booked for tomorrow or later.",
      code: "VALIDATION",
    };
  }

  const appointmentDate = new Date(`${parsed.data.scheduled_date}T00:00:00`);
  const dayOfWeek = appointmentDate.getDay();
  const [{ data: clinician }, { data: availability }, { data: block }, { data: existing }] = await Promise.all([
    admin
      .from("clinic_accounts")
      .select("id, user_id, display_name, role")
      .eq("id", parsed.data.doctor_id)
      .eq("is_active", true)
      .in("role", ["doctor", "nurse"])
      .maybeSingle(),
    admin
      .from("staff_availability")
      .select("start_time, end_time")
      .eq("clinic_account_id", parsed.data.doctor_id)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true),
    admin
      .from("clinician_schedule_blocks")
      .select("id")
      .eq("clinic_account_id", parsed.data.doctor_id)
      .eq("blocked_date", parsed.data.scheduled_date)
      .lte("start_time", parsed.data.scheduled_time)
      .gt("end_time", parsed.data.scheduled_time)
      .maybeSingle(),
    admin
      .from("appointments")
      .select("id")
      .eq("doctor_id", parsed.data.doctor_id)
      .eq("scheduled_date", parsed.data.scheduled_date)
      .eq("scheduled_time", parsed.data.scheduled_time)
      .in("status", ["scheduled", "reminded", "checked_in", "in_consultation"])
      .maybeSingle(),
  ]);
  const fitsAvailability = (availability ?? []).some((window) =>
    parsed.data.scheduled_time >= window.start_time &&
    parsed.data.scheduled_time.slice(0, 5) < window.end_time.slice(0, 5),
  );
  if (!clinician || !fitsAvailability || block || existing) {
    return {
      success: false,
      error: "That time is no longer available. Choose another available time on this date.",
      code: "SLOT_TAKEN",
    };
  }

  const { data, error } = await admin
    .from("appointments")
    .insert({ ...parsed.data, status: "scheduled" })
    .select(
      "id, patient_type, reason, symptoms, priority, scheduled_date, scheduled_time, status, created_at",
    )
    .single();
  if (error || !data)
    return {
      success: false,
      error: error?.code === "23505"
        ? "That time was just taken. Choose another available time on this date."
        : "Unable to create appointment",
      code: error?.code === "23505" ? "SLOT_TAKEN" : "DATABASE",
    };

  await writeAuditLog(actor, "appointment.scheduled", "appointment", data.id);
  await sendNotification(actor, {
    receiver_id: clinician.user_id,
    title: "New appointment booked",
    message: `A patient booked ${parsed.data.scheduled_date} at ${parsed.data.scheduled_time.slice(0, 5)}.`,
    type: "appointment",
    entity_type: "appointment",
    entity_id: data.id,
  });
  await sendNotification(null, {
    receiver_id: actor.id,
    title: "Appointment confirmed",
    message: `Your appointment with ${clinician.display_name} is scheduled for ${parsed.data.scheduled_date} at ${parsed.data.scheduled_time.slice(0, 5)}.`,
    type: "appointment",
    entity_type: "appointment",
    entity_id: data.id,
  });
  revalidatePath(`/${actor.role}/appointments`);
  revalidatePath("/admin/appointments/calendar");
  revalidatePath("/doctor/appointments/calendar");
  revalidatePath("/nurse/appointments/calendar");
  return { success: true, data: toAppointmentDTO(data) };

  /*
  // ──── AI EVALUATION & AUTO ASSIGNMENT ────
  let priorityScore = 3;
  let assignedStaffId: string | null = null;
  let assignedStaffUserId: string | null = null;

  try {
    // 1. Run AI Evaluation with availability-aware assignment
    const aiResult = await evaluateAppointmentWithAI({
      actorId: actor.id,
      appointmentId: data.id,
      reason: data.reason,
      symptoms: data.symptoms,
      scheduledDate: data.scheduled_date ?? null,
      scheduledTime: data.scheduled_time ?? null,
    });

    priorityScore = aiResult.evaluation.priority_score;

    // Save AI evaluation details
    await admin.from("appointment_ai_evaluations").insert({
      appointment_id: data.id,
      priority_score: aiResult.evaluation.priority_score,
      recommended_slot: aiResult.evaluation.recommended_slot,
      rationale: aiResult.evaluation.rationale,
      ai_log_id: aiResult.logId,
    });

    // 2. Determine target role based on priority score (>= 4 is doctor, else nurse)
    const targetRole = priorityScore >= 4 ? "doctor" : "nurse";

    // 3. Find active clinic accounts matching target role
    let { data: staffList } = await admin
      .from("clinic_accounts")
      .select("id, user_id, role, display_name")
      .eq("is_active", true)
      .eq("role", targetRole);

    // Fallback: If no active staff with target role, search for any active doctors or nurses
    if (!staffList || staffList.length === 0) {
      const fallbackResult = await admin
        .from("clinic_accounts")
        .select("id, user_id, role, display_name")
        .eq("is_active", true)
        .in("role", ["nurse", "doctor"]);
      staffList = fallbackResult.data;
    }

    if (staffList && staffList.length > 0) {
      // 4. Prefer AI-recommended staff if valid, otherwise fallback to lowest workload
      const aiRecommended = aiResult.evaluation.recommended_staff_id
        ? staffList.find((s) => s.id === aiResult.evaluation.recommended_staff_id)
        : null;

      let chosenStaff = aiRecommended;

      if (!chosenStaff) {
        // 4b. Calculate workloads (active appointments counts)
        const { data: activeApts } = await admin
          .from("appointments")
          .select("doctor_id")
          .in("status", [
            "pending",
            "ai_evaluated",
            "recommended",
            "approved",
            "scheduled",
            "reminded",
            "checked_in",
            "in_consultation",
          ])
          .not("doctor_id", "is", null);

        const workloadMap: Record<string, number> = {};
        staffList.forEach((s) => {
          workloadMap[s.id] = 0;
        });
        if (activeApts) {
          activeApts.forEach((apt) => {
            if (apt.doctor_id && apt.doctor_id in workloadMap) {
              workloadMap[apt.doctor_id]++;
            }
          });
        }

        // 5. Select staff with lowest workload
        const sortedStaff = [...staffList].sort(
          (a, b) => workloadMap[a.id] - workloadMap[b.id],
        );
        chosenStaff = sortedStaff[0];
      }

      assignedStaffId = chosenStaff.id;
      assignedStaffUserId = chosenStaff.user_id;

      // 6. Update appointment with assignment and schedule it
      await admin
        .from("appointments")
        .update({
          priority: priorityScore,
          doctor_id: assignedStaffId,
          status: "scheduled",
        })
        .eq("id", data.id);

      // 7. Send notification to the assigned staff member
      await sendNotification(null, {
        receiver_id: assignedStaffUserId,
        title: `Appointment Assigned (AI Triage: Priority ${priorityScore})`,
        message: `You have been automatically assigned a new appointment for ${data.reason}. Date: ${data.scheduled_date} at ${data.scheduled_time}.`,
        type: "appointment",
        entity_type: "appointment",
        entity_id: data.id,
      });
    }
  } catch (err) {
    console.error("AI Auto-assignment failed:", err);
  }

  // Fetch updated appointment details to return
  const { data: finalAppointment } = await admin
    .from("appointments")
    .select(
      "id, patient_type, reason, symptoms, priority, scheduled_date, scheduled_time, status, created_at",
    )
    .eq("id", data.id)
    .single();

  revalidatePath(`/${actor.role}/appointments`);
  return { success: true, data: toAppointmentDTO(finalAppointment || data) };
  */
}

/** Runs the advisory-only evaluator. It never approves or schedules an appointment. */
export async function evaluateAppointmentRequest(
  appointmentId: string,
): Promise<ActionResult<null>> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "nurse", "doctor"]))
    return forbidden();
  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select("id, reason, symptoms, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment)
    return {
      success: false,
      error: "Appointment not found",
      code: "NOT_FOUND",
    };
  if (appointment.status !== "pending")
    return {
      success: false,
      error: "Appointment cannot be evaluated in its current state",
      code: "INVALID_STATE",
    };

  const result = await evaluateAppointmentWithAI({
    actorId: actor.id,
    appointmentId,
    reason: appointment.reason,
    symptoms: appointment.symptoms,
  });
  const { error } = await admin.from("appointment_ai_evaluations").insert({
    appointment_id: appointmentId,
    priority_score: result.evaluation.priority_score,
    recommended_slot: result.evaluation.recommended_slot,
    rationale: result.evaluation.rationale,
    ai_log_id: result.logId,
  });
  if (error)
    return {
      success: false,
      error: "Unable to save AI evaluation",
      code: "DATABASE",
    };

  await admin
    .from("appointments")
    .update({
      priority: result.evaluation.priority_score,
      status: "ai_evaluated",
    })
    .eq("id", appointmentId);
  await writeAuditLog(
    actor,
    "appointment.ai_evaluated",
    "appointment",
    appointmentId,
    { ai_status: result.status },
  );
  return { success: true, data: null };
}

export async function recommendAppointment(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["doctor", "nurse"])) return forbidden();
  const parsed = AppointmentRecommendationSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: "Invalid recommendation",
      code: "VALIDATION",
    };
  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select("status")
    .eq("id", parsed.data.appointment_id)
    .maybeSingle();
  if (!appointment)
    return {
      success: false,
      error: "Appointment not found",
      code: "NOT_FOUND",
    };
  if (!canTransition(appointment.status as AppointmentStatus, "recommended"))
    return invalidTransition();
  const { error } = await admin
    .from("appointments")
    .update({ status: "recommended" })
    .eq("id", parsed.data.appointment_id);
  if (error)
    return {
      success: false,
      error: "Unable to save recommendation",
      code: "DATABASE",
    };
  await admin.from("appointment_recommendations").insert({
    appointment_id: parsed.data.appointment_id,
    recommended_by: actor.id,
    recommendation: parsed.data.recommendation,
    notes: parsed.data.notes ?? null,
    recommended_date: parsed.data.recommended_date ?? null,
    recommended_time: parsed.data.recommended_time ?? null,
  });
  await writeAuditLog(
    actor,
    "appointment.recommended",
    "appointment",
    parsed.data.appointment_id,
    { recommendation: parsed.data.recommendation },
  );
  return { success: true, data: null };
}

/** Nurse/admin decision. Scheduling details are deliberately required for approval. */
export async function reviewAppointment(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "nurse"])) return forbidden();
  const parsed = AppointmentReviewSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Invalid review", code: "VALIDATION" };
  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select("id, status, patient_type, student_id, faculty_id")
    .eq("id", parsed.data.appointment_id)
    .maybeSingle();
  if (!appointment)
    return {
      success: false,
      error: "Appointment not found",
      code: "NOT_FOUND",
    };
  if (
    !canTransition(
      appointment.status as AppointmentStatus,
      parsed.data.decision === "approved" ? "scheduled" : "rejected",
    )
  )
    return invalidTransition();

  if (parsed.data.decision === "rejected") {
    const { error } = await admin
      .from("appointments")
      .update({ status: "rejected" })
      .eq("id", appointment.id);
    if (error)
      return {
        success: false,
        error: "Unable to reject appointment",
        code: "DATABASE",
      };
    await writeAuditLog(
      actor,
      "appointment.rejected",
      "appointment",
      appointment.id,
      { reason: parsed.data.rejection_reason ?? null },
    );
    return { success: true, data: null };
  }
  return {
    success: false,
    error: "Use scheduleApprovedAppointment to schedule an approved request",
    code: "SCHEDULE_REQUIRED",
  };
}

export async function scheduleApprovedAppointment(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "nurse"])) return forbidden();
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Invalid schedule", code: "VALIDATION" };
  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select("id, status, patient_type, student_id, faculty_id")
    .eq("id", parsed.data.appointment_id)
    .maybeSingle();
  if (!appointment)
    return {
      success: false,
      error: "Appointment not found",
      code: "NOT_FOUND",
    };
  if (!canTransition(appointment.status as AppointmentStatus, "scheduled"))
    return invalidTransition();

  const { error } = await admin
    .from("appointments")
    .update({
      scheduled_date: parsed.data.scheduled_date,
      scheduled_time: parsed.data.scheduled_time,
      doctor_id: parsed.data.doctor_id ?? null,
      status: "scheduled",
    })
    .eq("id", appointment.id);
  if (error)
    return {
      success: false,
      error: "Unable to schedule appointment",
      code: "DATABASE",
    };
  const receiverId = await getPatientUserId(
    admin,
    appointment.patient_type,
    appointment.student_id,
    appointment.faculty_id,
  );
  if (receiverId) {
    const scheduledAt = new Date(
      `${parsed.data.scheduled_date}T${parsed.data.scheduled_time}`,
    );
    await admin.from("appointment_reminders").insert([
      {
        appointment_id: appointment.id,
        remind_at: new Date(
          scheduledAt.getTime() - 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      {
        appointment_id: appointment.id,
        remind_at: new Date(
          scheduledAt.getTime() - 60 * 60 * 1000,
        ).toISOString(),
      },
    ]);
    await sendNotification(actor, {
      receiver_id: receiverId,
      title: "Appointment scheduled",
      message: `Your appointment is scheduled for ${parsed.data.scheduled_date} at ${parsed.data.scheduled_time}.`,
      type: "appointment",
      entity_type: "appointment",
      entity_id: appointment.id,
    });
  }
  await writeAuditLog(
    actor,
    "appointment.scheduled",
    "appointment",
    appointment.id,
  );
  return { success: true, data: null };
}

export async function checkInAppointment(
  input: unknown,
): Promise<ActionResult<null>> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "nurse", "doctor"]))
    return forbidden();
  const parsed = AppointmentCheckinSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Invalid check-in", code: "VALIDATION" };
  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select("status")
    .eq("id", parsed.data.appointment_id)
    .maybeSingle();
  if (!appointment)
    return {
      success: false,
      error: "Appointment not found",
      code: "NOT_FOUND",
    };
  if (!canTransition(appointment.status as AppointmentStatus, "checked_in"))
    return invalidTransition();
  const { error } = await admin.from("appointment_checkins").insert({
    appointment_id: parsed.data.appointment_id,
    rfid_uid: parsed.data.rfid_uid ?? null,
  });
  if (error)
    return {
      success: false,
      error: "Unable to record check-in",
      code: "DATABASE",
    };
  await admin
    .from("appointments")
    .update({ status: "checked_in" })
    .eq("id", parsed.data.appointment_id);
  await writeAuditLog(
    actor,
    "appointment.checked_in",
    "appointment",
    parsed.data.appointment_id,
  );
  return { success: true, data: null };
}

export async function getMyAppointments(): Promise<{
  error: string | null;
  appointments: AppointmentDTO[];
}> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["student", "faculty", "staff"]))
    return { error: "Not authenticated", appointments: [] };

  const profileTable = actor.role === "student" ? "students" : "faculty";
  const profileIdField = actor.role === "student" ? "student_id" : "faculty_id";
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from(profileTable)
    .select("id")
    .eq("user_id", actor.id)
    .maybeSingle();
  if (!profile) return { error: "Patient profile not found", appointments: [] };

  const { data, error } = await admin
    .from("appointments")
    .select(
      "id, patient_type, reason, symptoms, priority, scheduled_date, scheduled_time, status, created_at",
    )
    .eq(profileIdField, profile.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, appointments: [] };
  return { error: null, appointments: (data || []).map(toAppointmentDTO) };
}

function toAppointmentDTO(row: {
  id: string;
  patient_type: "student" | "faculty";
  reason: string;
  symptoms: string | null;
  priority: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: AppointmentStatus;
  created_at: string;
}): AppointmentDTO {
  return {
    ...row,
    patient_name: "",
    patient_identifier: "",
    doctor_name: null,
    ai_evaluation: null,
  };
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
function invalidTransition(): ActionResult<never> {
  return {
    success: false,
    error: "Appointment cannot transition from its current state",
    code: "INVALID_STATE",
  };
}
function forbidden(message = "Forbidden"): ActionResult<never> {
  return { success: false, error: message, code: "FORBIDDEN" };
}

// Returns tomorrow using the clinic's configured operating timezone.
function clinicTomorrow() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = new Date(`${values.year}-${values.month}-${values.day}T00:00:00`);
  today.setDate(today.getDate() + 1);
  return today.toISOString().slice(0, 10);
}

async function getPatientUserId(
  admin: ReturnType<typeof createAdminClient>,
  patientType: string,
  studentId: string | null,
  facultyId: string | null,
): Promise<string | null> {
  const table = patientType === "student" ? "students" : "faculty";
  const id = patientType === "student" ? studentId : facultyId;
  if (!id) return null;
  const { data } = await admin
    .from(table)
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function cancelAppointment(
  appointmentId: string,
): Promise<ActionResult<null>> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["student", "faculty", "staff"]))
    return forbidden();

  const profileTable = actor.role === "student" ? "students" : "faculty";
  const profileIdField = actor.role === "student" ? "student_id" : "faculty_id";
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from(profileTable)
    .select("id")
    .eq("user_id", actor.id)
    .maybeSingle();
  if (!profile)
    return {
      success: false,
      error: "Patient profile not found",
      code: "NOT_FOUND",
    };

  const { data, error } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq(profileIdField, profile.id)
    .in("status", [
      "pending",
      "ai_evaluated",
      "recommended",
      "approved",
      "scheduled",
      "reminded",
    ])
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message, code: "DATABASE" };
  if (!data)
    return {
      success: false,
      error: "Appointment cannot be cancelled or is not yours",
      code: "PRECONDITION",
    };

  await writeAuditLog(
    actor,
    "appointment.cancelled",
    "appointment",
    appointmentId,
  );
  revalidatePath(`/${actor.role}/appointments`);
  return { success: true, data: null };
}
