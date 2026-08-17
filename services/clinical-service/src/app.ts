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

import {
  enforceRfidRateLimit,
  invokeRfidEdgeFunction,
  requireForwardedAccessToken,
  rfidCheckInSchema,
  type RfidCheckInInvoker,
} from "./rfid.js";

const patientTypeSchema = z.enum(["student", "faculty", "staff"]);
const idSchema = z.string().uuid();

interface PatientReference {
  id: string;
  patientType: "student" | "faculty" | "staff";
}

interface ClinicAccountReference {
  id: string;
  role: "admin" | "doctor" | "nurse";
  user_id: string;
}

interface ClinicalDependencies {
  contextSecret?: string;
  identityServiceUrl?: string;
  internalServiceKey?: string;
  invokeRfidCheckIn?: RfidCheckInInvoker;
  reportingServiceUrl?: string;
  timeoutMs?: number;
}

// Creates Clinical Service with patient ownership and clinician assignment boundaries.
export function createClinicalApp(
  dependencies: ClinicalDependencies = {},
): Express {
  const app = createServiceApp("clinical-service");
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
  const reportingServiceUrl =
    dependencies.reportingServiceUrl ??
    process.env.REPORTING_SERVICE_URL ??
    "http://localhost:4006";
  const timeoutMs = dependencies.timeoutMs ?? Number(process.env.SERVICE_TIMEOUT_MS ?? 8_000);

  app.use("/api/v1", requireInternalContext(contextSecret));

  app.post(
    "/api/v1/rfid/check-ins",
    requireRoles("admin", "doctor", "nurse"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      enforceRfidRateLimit(auth.userId);
      const parsed = rfidCheckInSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "The RFID check-in request is invalid.",
        );
      }
      const invoke = dependencies.invokeRfidCheckIn ?? invokeRfidEdgeFunction;
      const result = await invoke(
        parsed.data,
        requireForwardedAccessToken(request),
        timeoutMs,
      );
      sendData(response, result);
      void auditRfidCheckIn(
        auth,
        parsed.data.eventId,
        result,
        reportingServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
    }),
  );

  app.get(
    "/api/v1/records/me",
    requireRoles("student", "faculty", "staff"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const patient = await patientReference(
        auth.userId,
        request.requestId,
        identityServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      sendData(response, await loadPatientRecord(patient));
      void auditRecordView(
        auth,
        patient,
        reportingServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
    }),
  );

  app.get(
    "/api/v1/records/:patientType/:patientId",
    requireRoles("admin", "doctor", "nurse"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const patient = {
        id: idSchema.parse(request.params.patientId),
        patientType: patientTypeSchema.parse(request.params.patientType),
      };
      await requireClinicalAssignment(
        auth,
        patient,
        request.requestId,
        identityServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      sendData(response, await loadPatientRecord(patient));
      void auditRecordView(
        auth,
        patient,
        reportingServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
    }),
  );

  app.get(
    "/api/v1/consultations",
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid pagination.");
      const scope = await clinicalScope(
        auth,
        request.requestId,
        identityServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      const { from, to } = paginationRange(parsed.data.page, parsed.data.limit);
      let query = createAdminClient()
        .from("consultations")
        .select(
          "id,visit_id,appointment_id,doctor_id,nurse_id,patient_complaint,status,created_at,completed_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (scope.kind === "clinician") {
        query = query.or(
          `doctor_id.eq.${scope.clinicAccountId},nurse_id.eq.${scope.clinicAccountId}`,
        );
      } else if (scope.kind === "patient") {
        const visitIds = await patientVisitIds(scope.patient);
        if (visitIds.length === 0) {
          sendCollection(
            response,
            [],
            paginationMeta(parsed.data.page, parsed.data.limit, 0),
          );
          return;
        }
        query = query.in("visit_id", visitIds);
      }
      const { data, count, error } = await query;
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load consultations.");
      sendCollection(
        response,
        data ?? [],
        paginationMeta(parsed.data.page, parsed.data.limit, count ?? 0),
      );
    }),
  );

  app.get(
    "/api/v1/visits",
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid pagination.");
      const scope = await clinicalScope(
        auth,
        request.requestId,
        identityServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      const { from, to } = paginationRange(parsed.data.page, parsed.data.limit);
      let query = createAdminClient()
        .from("clinic_visits")
        .select(
          "id,patient_type,student_id,faculty_id,staff_id,check_in_time,check_out_time,visit_type,status,created_at",
          { count: "exact" },
        )
        .order("check_in_time", { ascending: false })
        .range(from, to);
      if (scope.kind === "patient") {
        query = query.eq(`${scope.patient.patientType}_id`, scope.patient.id);
      } else if (scope.kind === "clinician") {
        const consultationVisitIds = await assignedVisitIds(scope.clinicAccountId);
        if (consultationVisitIds.length === 0) {
          sendCollection(
            response,
            [],
            paginationMeta(parsed.data.page, parsed.data.limit, 0),
          );
          return;
        }
        query = query.in("id", consultationVisitIds);
      }
      const { data, count, error } = await query;
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load visits.");
      sendCollection(
        response,
        data ?? [],
        paginationMeta(parsed.data.page, parsed.data.limit, count ?? 0),
      );
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

type ClinicalScope =
  | { kind: "all" }
  | { clinicAccountId: string; kind: "clinician" }
  | { kind: "patient"; patient: PatientReference };

// Requires a signed authenticated context for clinical access.
function authenticated(context: AuthContext | undefined): AuthContext {
  if (!context) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return context;
}

// Resolves one authenticated user to a clinical ownership or assignment scope.
async function clinicalScope(
  auth: AuthContext,
  requestId: string,
  identityUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<ClinicalScope> {
  const role = primaryRole(auth, ["admin", "doctor", "nurse", "student", "faculty", "staff"]);
  if (role === "admin") return { kind: "all" };
  if (role === "doctor" || role === "nurse") {
    const account = await clinicAccountReference(
      auth.userId,
      requestId,
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
      requestId,
      identityUrl,
      serviceKey,
      timeoutMs,
    ),
  };
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

// Resolves the signed-in clinician without directly reading Identity-owned tables.
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

// Verifies that a clinician is assigned to at least one consultation for the patient.
async function requireClinicalAssignment(
  auth: AuthContext,
  patient: PatientReference,
  requestId: string,
  identityUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<void> {
  const role = primaryRole(auth);
  if (role === "admin") return;
  const account = await clinicAccountReference(
    auth.userId,
    requestId,
    identityUrl,
    serviceKey,
    timeoutMs,
  );
  const visitIds = await patientVisitIds(patient);
  if (visitIds.length === 0) {
    throw new AppError(403, "FORBIDDEN", "No assigned clinical relationship exists.");
  }
  const { data, error } = await createAdminClient()
    .from("consultations")
    .select("id")
    .in("visit_id", visitIds)
    .or(`doctor_id.eq.${account.id},nurse_id.eq.${account.id}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to verify clinical assignment.");
  if (!data) throw new AppError(403, "FORBIDDEN", "No assigned clinical relationship exists.");
}

// Loads the minimized record summary for one already-authorized patient.
async function loadPatientRecord(patient: PatientReference): Promise<unknown> {
  const admin = createAdminClient();
  const visitIds = await patientVisitIds(patient);
  if (visitIds.length === 0) {
    return { patient, visits: [], consultations: [] };
  }
  const [visits, consultations] = await Promise.all([
    admin
      .from("clinic_visits")
      .select("id,check_in_time,check_out_time,visit_type,status")
      .in("id", visitIds)
      .order("check_in_time", { ascending: false })
      .limit(100),
    admin
      .from("consultations")
      .select(
        "id,visit_id,patient_complaint,consultation_notes,status,doctor_id,nurse_id,created_at,completed_at",
      )
      .in("visit_id", visitIds)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(100),
  ]);
  const error = visits.error ?? consultations.error;
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load medical record.");
  return {
    patient,
    visits: visits.data ?? [],
    consultations: consultations.data ?? [],
  };
}

// Returns visit identifiers belonging to one explicit patient type and ID.
async function patientVisitIds(patient: PatientReference): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("clinic_visits")
    .select("id")
    .eq(`${patient.patientType}_id`, patient.id);
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load patient visits.");
  return (data ?? []).map((visit) => visit.id);
}

// Returns visit identifiers assigned to one clinician account.
async function assignedVisitIds(clinicAccountId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("consultations")
    .select("visit_id")
    .or(`doctor_id.eq.${clinicAccountId},nurse_id.eq.${clinicAccountId}`)
    .limit(1_000);
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load assigned visits.");
  return [...new Set((data ?? []).map((row) => row.visit_id))];
}

// Records a PHI-free RFID execution event without logging the card value.
async function auditRfidCheckIn(
  auth: AuthContext,
  eventId: string,
  result: {
    createdNew: boolean;
    patientType: "student" | "faculty" | "staff";
    queueEntryId: string;
  },
  reportingUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await serviceRequest(`${reportingUrl}/internal/audit`, {
      body: {
        action: "RFID_SCAN",
        entityId: result.queueEntryId,
        entityType: "rfid_check_in",
        metadata: {
          createdNew: result.createdNew,
          eventId,
          executionPath: "edge",
          patientType: result.patientType,
        },
        userId: auth.userId,
      },
      requestId: auth.requestId,
      serviceKey,
      timeoutMs,
    });
  } catch {
    console.error(
      JSON.stringify({
        code: "AUDIT_WRITE_FAILED",
        event: "audit_write_failed",
        requestId: auth.requestId,
        service: "clinical-service",
      }),
    );
  }
}

// Records a sanitized medical-record access event without delaying the read response.
async function auditRecordView(
  auth: AuthContext,
  patient: PatientReference,
  reportingUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await serviceRequest(`${reportingUrl}/internal/audit`, {
      body: {
        action: "VIEW_MEDICAL_RECORD",
        entityId: patient.id,
        entityType: `${patient.patientType}_record`,
        metadata: { source: "clinical-service" },
        userId: auth.userId,
      },
      requestId: auth.requestId,
      serviceKey,
      timeoutMs,
    });
  } catch {
    console.error(
      JSON.stringify({
        code: "AUDIT_WRITE_FAILED",
        event: "audit_write_failed",
        requestId: auth.requestId,
        service: "clinical-service",
      }),
    );
  }
}
