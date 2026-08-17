import type { Express } from "express";
import { z } from "zod";

import {
  AppError,
  asyncRoute,
  createAdminClient,
  createServiceApp,
  errorHandler,
  notFoundHandler,
  paginationMeta,
  paginationRange,
  paginationSchema,
  primaryRole,
  requireInternalContext,
  requireRoles,
  requireStrongSecret,
  sendCollection,
  sendData,
  serviceRequest,
  type AuthContext,
} from "@zentraq/shared";

const appointmentStatuses = [
  "pending",
  "ai_evaluated",
  "recommended",
  "approved",
  "rejected",
  "scheduled",
  "reminded",
  "checked_in",
  "in_consultation",
  "completed",
  "cancelled",
  "no_show",
] as const;

type AppointmentStatus = (typeof appointmentStatuses)[number];

const createAppointmentSchema = z.object({
  doctorId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  scheduledDate: z.iso.date(),
  scheduledTime: z.iso.time({ precision: -1 }),
  symptoms: z.string().trim().max(2_000).optional().nullable(),
});

const updateAppointmentSchema = z.object({
  scheduledDate: z.iso.date().optional(),
  scheduledTime: z.iso.time({ precision: -1 }).optional(),
  status: z.enum(appointmentStatuses),
});

const availabilitySchema = z.object({
  clinicianId: z.string().uuid(),
  date: z.iso.date(),
});

const idSchema = z.string().uuid();

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

interface PatientReference {
  id: string;
  patientType: "student" | "faculty" | "staff";
}

interface ClinicAccountReference {
  display_name: string;
  id: string;
  is_active: boolean;
  role: "admin" | "doctor" | "nurse";
  user_id: string;
}

interface AppointmentDependencies {
  contextSecret?: string;
  identityServiceUrl?: string;
  internalServiceKey?: string;
  notificationServiceUrl?: string;
  reportingServiceUrl?: string;
  timeoutMs?: number;
}

// Creates Appointment Service with patient ownership and clinician assignment checks.
export function createAppointmentApp(
  dependencies: AppointmentDependencies = {},
): Express {
  const app = createServiceApp("appointment-service");
  const contextSecret =
    dependencies.contextSecret ??
    requireStrongSecret(process.env.INTERNAL_CONTEXT_SECRET, "INTERNAL_CONTEXT_SECRET");
  const internalServiceKey =
    dependencies.internalServiceKey ??
    requireStrongSecret(process.env.INTERNAL_SERVICE_KEY, "INTERNAL_SERVICE_KEY");
  const identityServiceUrl =
    dependencies.identityServiceUrl ??
    process.env.IDENTITY_SERVICE_URL ??
    "http://localhost:4001";
  const notificationServiceUrl =
    dependencies.notificationServiceUrl ??
    process.env.NOTIFICATION_SERVICE_URL ??
    "http://localhost:4005";
  const reportingServiceUrl =
    dependencies.reportingServiceUrl ??
    process.env.REPORTING_SERVICE_URL ??
    "http://localhost:4006";
  const timeoutMs = dependencies.timeoutMs ?? Number(process.env.SERVICE_TIMEOUT_MS ?? 8_000);

  app.use("/api/v1", requireInternalContext(contextSecret));

  app.get(
    "/api/v1/appointments",
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const parsed = paginationSchema
        .extend({ status: z.enum(appointmentStatuses).optional() })
        .safeParse(request.query);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid appointment filters.");
      const scope = await appointmentScope(
        auth,
        identityServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      const { from, to } = paginationRange(parsed.data.page, parsed.data.limit);
      let query = createAdminClient()
        .from("appointments")
        .select(
          "id,patient_type,student_id,faculty_id,staff_id,doctor_id,reason,symptoms,priority,scheduled_date,scheduled_time,status,created_at,updated_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      query = applyAppointmentScope(query, scope);
      if (parsed.data.status) query = query.eq("status", parsed.data.status);
      const { data, count, error } = await query;
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load appointments.");
      sendCollection(
        response,
        data ?? [],
        paginationMeta(parsed.data.page, parsed.data.limit, count ?? 0),
      );
    }),
  );

  app.post(
    "/api/v1/appointments",
    requireRoles("student", "faculty", "staff"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const parsed = createAppointmentSchema.safeParse(request.body);
      if (!parsed.success || parsed.data.scheduledDate < clinicTomorrow()) {
        throw new AppError(400, "VALIDATION_ERROR", "Enter a valid future appointment schedule.");
      }
      const [patient, clinician] = await Promise.all([
        patientReference(
          auth.userId,
          request.requestId,
          identityServiceUrl,
          internalServiceKey,
          timeoutMs,
        ),
        clinicianReference(
          parsed.data.doctorId,
          request.requestId,
          identityServiceUrl,
          internalServiceKey,
          timeoutMs,
        ),
      ]);
      await assertSlotAvailable(
        parsed.data.doctorId,
        parsed.data.scheduledDate,
        parsed.data.scheduledTime,
      );
      const patientColumn = `${patient.patientType}_id`;
      const { data, error } = await createAdminClient()
        .from("appointments")
        .insert({
          doctor_id: parsed.data.doctorId,
          patient_type: patient.patientType,
          [patientColumn]: patient.id,
          reason: parsed.data.reason,
          scheduled_date: parsed.data.scheduledDate,
          scheduled_time: parsed.data.scheduledTime,
          status: "scheduled",
          symptoms: parsed.data.symptoms ?? null,
        })
        .select(
          "id,patient_type,doctor_id,reason,symptoms,priority,scheduled_date,scheduled_time,status,created_at",
        )
        .single();
      if (error || !data) {
        throw new AppError(
          error?.code === "23505" ? 409 : 503,
          error?.code === "23505" ? "SLOT_TAKEN" : "DATABASE_UNAVAILABLE",
          error?.code === "23505"
            ? "That appointment time is no longer available."
            : "Unable to create appointment.",
        );
      }
      void publishAppointmentSideEffects({
        appointmentId: data.id,
        auth,
        clinician,
        internalServiceKey,
        notificationServiceUrl,
        reportingServiceUrl,
        requestId: request.requestId,
        schedule: `${parsed.data.scheduledDate} ${parsed.data.scheduledTime}`,
        timeoutMs,
      });
      sendData(response, data, 201);
    }),
  );

  app.get(
    "/api/v1/appointments/availability",
    asyncRoute(async (request, response) => {
      const parsed = availabilitySchema.safeParse(request.query);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid availability request.");
      const clinician = await clinicianReference(
        parsed.data.clinicianId,
        request.requestId,
        identityServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      const dayOfWeek = new Date(`${parsed.data.date}T00:00:00+08:00`).getDay();
      const admin = createAdminClient();
      const [availability, blocks, appointments] = await Promise.all([
        admin
          .from("staff_availability")
          .select("id,day_of_week,start_time,end_time")
          .eq("clinic_account_id", clinician.id)
          .eq("day_of_week", dayOfWeek)
          .eq("is_active", true),
        admin
          .from("clinician_schedule_blocks")
          .select("id,start_time,end_time,reason")
          .eq("clinic_account_id", clinician.id)
          .eq("blocked_date", parsed.data.date),
        admin
          .from("appointments")
          .select("id,scheduled_time,status")
          .eq("doctor_id", clinician.id)
          .eq("scheduled_date", parsed.data.date)
          .in("status", ["scheduled", "reminded", "checked_in", "in_consultation"]),
      ]);
      const error = availability.error ?? blocks.error ?? appointments.error;
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load availability.");
      sendData(response, {
        availability: availability.data ?? [],
        blocks: blocks.data ?? [],
        clinician: { id: clinician.id, displayName: clinician.display_name, role: clinician.role },
        occupied: appointments.data ?? [],
      });
    }),
  );

  app.get(
    "/api/v1/appointments/:appointmentId",
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const appointmentId = idSchema.parse(request.params.appointmentId);
      const scope = await appointmentScope(
        auth,
        identityServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      let query = createAdminClient()
        .from("appointments")
        .select(
          "id,patient_type,student_id,faculty_id,staff_id,doctor_id,reason,symptoms,priority,scheduled_date,scheduled_time,status,created_at,updated_at",
        )
        .eq("id", appointmentId);
      query = applyAppointmentScope(query, scope);
      const { data, error } = await query.maybeSingle();
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load appointment.");
      if (!data) throw new AppError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found.");
      sendData(response, data);
    }),
  );

  app.patch(
    "/api/v1/appointments/:appointmentId",
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const appointmentId = idSchema.parse(request.params.appointmentId);
      const parsed = updateAppointmentSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid appointment update.");
      const scope = await appointmentScope(
        auth,
        identityServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      let currentQuery = createAdminClient()
        .from("appointments")
        .select("id,status,doctor_id,student_id,faculty_id,staff_id")
        .eq("id", appointmentId);
      currentQuery = applyAppointmentScope(currentQuery, scope);
      const { data: current, error: currentError } = await currentQuery.maybeSingle();
      if (currentError) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to update appointment.");
      if (!current) throw new AppError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found.");
      const from = current.status as AppointmentStatus;
      if (!ALLOWED_TRANSITIONS[from]?.includes(parsed.data.status)) {
        throw new AppError(409, "INVALID_STATE", "The appointment cannot enter that state.");
      }
      const role = primaryRole(auth);
      if (["student", "faculty", "staff"].includes(role) && parsed.data.status !== "cancelled") {
        throw new AppError(403, "FORBIDDEN", "Patients may only cancel their own appointment.");
      }
      if (
        parsed.data.scheduledDate &&
        parsed.data.scheduledTime &&
        current.doctor_id
      ) {
        await assertSlotAvailable(
          current.doctor_id,
          parsed.data.scheduledDate,
          parsed.data.scheduledTime,
          appointmentId,
        );
      }
      const { data, error } = await createAdminClient()
        .from("appointments")
        .update({
          scheduled_date: parsed.data.scheduledDate,
          scheduled_time: parsed.data.scheduledTime,
          status: parsed.data.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .select("id,scheduled_date,scheduled_time,status,updated_at")
        .single();
      if (error || !data) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to update appointment.");
      sendData(response, data);
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

type AppointmentScope =
  | { kind: "all" }
  | { clinicAccountId: string; kind: "clinician" }
  | { kind: "patient"; patient: PatientReference };

// Requires the signed gateway context before domain access.
function authenticated(context: AuthContext | undefined): AuthContext {
  if (!context) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return context;
}

// Resolves one role into an appointment ownership or assignment scope.
async function appointmentScope(
  auth: AuthContext,
  identityUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<AppointmentScope> {
  const role = primaryRole(auth, ["admin", "doctor", "nurse", "student", "faculty", "staff"]);
  if (role === "admin") return { kind: "all" };
  if (role === "doctor" || role === "nurse") {
    const account = await clinicAccountReference(
      auth.userId,
      auth.requestId,
      identityUrl,
      serviceKey,
      timeoutMs,
    );
    return { kind: "clinician", clinicAccountId: account.id };
  }
  return {
    kind: "patient",
    patient: await patientReference(
      auth.userId,
      auth.requestId,
      identityUrl,
      serviceKey,
      timeoutMs,
    ),
  };
}

// Applies an already-authorized ownership scope to a Supabase query builder.
function applyAppointmentScope<T>(query: T, scope: AppointmentScope): T {
  const builder = query as T & { eq(column: string, value: string): T };
  if (scope.kind === "clinician") return builder.eq("doctor_id", scope.clinicAccountId);
  if (scope.kind === "patient") {
    return builder.eq(`${scope.patient.patientType}_id`, scope.patient.id);
  }
  return query;
}

// Resolves the current user through the Identity Service patient boundary.
async function patientReference(
  userId: string,
  requestId: string,
  identityUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<PatientReference> {
  return serviceRequest<PatientReference>(
    `${identityUrl}/internal/users/${userId}/patient-ref`,
    { requestId, serviceKey, timeoutMs },
  );
}

// Resolves an active clinician without querying Identity-owned tables directly.
async function clinicianReference(
  clinicAccountId: string,
  requestId: string,
  identityUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<ClinicAccountReference> {
  return serviceRequest<ClinicAccountReference>(
    `${identityUrl}/internal/clinicians/${clinicAccountId}`,
    { requestId, serviceKey, timeoutMs },
  );
}

// Resolves the signed-in clinician's active clinic account through Identity Service.
async function clinicAccountReference(
  userId: string,
  requestId: string,
  identityUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<ClinicAccountReference> {
  return serviceRequest<ClinicAccountReference>(
    `${identityUrl}/internal/users/${userId}/clinic-account`,
    { requestId, serviceKey, timeoutMs },
  );
}

// Verifies availability, blocks, and occupied slots before scheduling.
async function assertSlotAvailable(
  clinicianId: string,
  date: string,
  time: string,
  excludedAppointmentId?: string,
): Promise<void> {
  const dayOfWeek = new Date(`${date}T00:00:00+08:00`).getDay();
  const admin = createAdminClient();
  let conflictQuery = admin
    .from("appointments")
    .select("id")
    .eq("doctor_id", clinicianId)
    .eq("scheduled_date", date)
    .eq("scheduled_time", time)
    .in("status", ["scheduled", "reminded", "checked_in", "in_consultation"]);
  if (excludedAppointmentId) conflictQuery = conflictQuery.neq("id", excludedAppointmentId);
  const [availability, block, conflict] = await Promise.all([
    admin
      .from("staff_availability")
      .select("start_time,end_time")
      .eq("clinic_account_id", clinicianId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true),
    admin
      .from("clinician_schedule_blocks")
      .select("id")
      .eq("clinic_account_id", clinicianId)
      .eq("blocked_date", date)
      .lte("start_time", time)
      .gt("end_time", time)
      .maybeSingle(),
    conflictQuery.maybeSingle(),
  ]);
  const error = availability.error ?? block.error ?? conflict.error;
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to validate appointment availability.");
  const fits = (availability.data ?? []).some(
    (window) => time >= window.start_time && time.slice(0, 5) < window.end_time.slice(0, 5),
  );
  if (!fits || block.data || conflict.data) {
    throw new AppError(409, "SLOT_TAKEN", "That appointment time is no longer available.");
  }
}

// Returns tomorrow's date in the clinic timezone for booking validation.
function clinicTomorrow(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);
}

// Publishes non-transactional notifications and audit data after booking succeeds.
async function publishAppointmentSideEffects(input: {
  appointmentId: string;
  auth: AuthContext;
  clinician: ClinicAccountReference;
  internalServiceKey: string;
  notificationServiceUrl: string;
  reportingServiceUrl: string;
  requestId: string;
  schedule: string;
  timeoutMs: number;
}): Promise<void> {
  const calls = [
    serviceRequest(
      `${input.notificationServiceUrl}/internal/notifications`,
      {
        body: {
          entityId: input.appointmentId,
          entityType: "appointment",
          message: `A patient booked ${input.schedule}.`,
          receiverId: input.clinician.user_id,
          senderId: input.auth.userId,
          title: "New appointment booked",
          type: "appointment",
        },
        requestId: input.requestId,
        serviceKey: input.internalServiceKey,
        timeoutMs: input.timeoutMs,
      },
    ),
    serviceRequest(
      `${input.notificationServiceUrl}/internal/notifications`,
      {
        body: {
          entityId: input.appointmentId,
          entityType: "appointment",
          message: `Your appointment is scheduled for ${input.schedule}.`,
          receiverId: input.auth.userId,
          title: "Appointment confirmed",
          type: "appointment",
        },
        requestId: input.requestId,
        serviceKey: input.internalServiceKey,
        timeoutMs: input.timeoutMs,
      },
    ),
    serviceRequest(
      `${input.reportingServiceUrl}/internal/audit`,
      {
        body: {
          action: "CREATE_APPOINTMENT",
          entityId: input.appointmentId,
          entityType: "appointment",
          metadata: { source: "appointment-service" },
          userId: input.auth.userId,
        },
        requestId: input.requestId,
        serviceKey: input.internalServiceKey,
        timeoutMs: input.timeoutMs,
      },
    ),
  ];
  const results = await Promise.allSettled(calls);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        JSON.stringify({
          code: "APPOINTMENT_SIDE_EFFECT_FAILED",
          event: "appointment_side_effect_failed",
          operation: index,
          requestId: input.requestId,
          service: "appointment-service",
        }),
      );
    }
  });
}
