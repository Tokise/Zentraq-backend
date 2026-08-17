import type { Express } from "express";
import { z } from "zod";

import {
  AppError,
  asyncRoute,
  createAdminClient,
  createAuthClient,
  createServiceApp,
  errorHandler,
  notFoundHandler,
  paginationMeta,
  paginationRange,
  paginationSchema,
  primaryRole,
  requireInternalContext,
  requireInternalServiceKey,
  requireRoles,
  requireStrongSecret,
  sendCollection,
  sendData,
  ZENTRAQ_ROLES,
  type ZentraqRole,
} from "@zentraq/shared";

const rfidSchema = z.object({
  rfidUid: z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9:_-]+$/),
});

const userIdSchema = z.string().uuid();

interface IdentityDependencies {
  contextSecret?: string;
  internalServiceKey?: string;
}

interface RoleRelation {
  roles: { name: string } | Array<{ name: string }> | null;
}

// Creates Identity Service routes for verified users, roles, and RFID relationships.
export function createIdentityApp(
  dependencies: IdentityDependencies = {},
): Express {
  const app = createServiceApp("identity-service");
  const internalServiceKey =
    dependencies.internalServiceKey ??
    requireStrongSecret(process.env.INTERNAL_SERVICE_KEY, "INTERNAL_SERVICE_KEY");
  const contextSecret =
    dependencies.contextSecret ??
    requireStrongSecret(
      process.env.INTERNAL_CONTEXT_SECRET,
      "INTERNAL_CONTEXT_SECRET",
    );

  app.post(
    "/internal/auth/resolve",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const token = bearerToken(request.header("authorization"));
      const authClient = createAuthClient();
      const {
        data: { user },
        error,
      } = await authClient.auth.getUser(token);
      if (error || !user) {
        throw new AppError(401, "UNAUTHENTICATED", "A valid access token is required.");
      }
      const roles = await resolveRoles(user.id);
      if (roles.length === 0) {
        throw new AppError(403, "ROLE_REQUIRED", "An active Zentraq role is required.");
      }
      sendData(response, { userId: user.id, roles });
    }),
  );

  app.get(
    "/internal/users/:userId/patient-ref",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const userId = userIdSchema.parse(request.params.userId);
      const patient = await resolvePatientReference(userId);
      if (!patient) throw new AppError(404, "PATIENT_NOT_FOUND", "Patient profile not found.");
      sendData(response, patient);
    }),
  );

  app.get(
    "/internal/clinicians/:clinicAccountId",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const clinicAccountId = userIdSchema.parse(request.params.clinicAccountId);
      const { data, error } = await createAdminClient()
        .from("clinic_accounts")
        .select("id,user_id,display_name,role,is_active")
        .eq("id", clinicAccountId)
        .eq("is_active", true)
        .in("role", ["doctor", "nurse"])
        .maybeSingle();
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to validate clinician.");
      if (!data) throw new AppError(404, "CLINICIAN_NOT_FOUND", "Clinician not found.");
      sendData(response, data);
    }),
  );

  app.get(
    "/internal/users/:userId/clinic-account",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const userId = userIdSchema.parse(request.params.userId);
      const { data, error } = await createAdminClient()
        .from("clinic_accounts")
        .select("id,user_id,display_name,role,is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .in("role", ["admin", "doctor", "nurse"])
        .maybeSingle();
      if (error) {
        throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to validate clinic account.");
      }
      if (!data) {
        throw new AppError(404, "CLINIC_ACCOUNT_NOT_FOUND", "Clinic account not found.");
      }
      sendData(response, data);
    }),
  );

  app.use("/api/v1", requireInternalContext(contextSecret));

  app.get(
    "/api/v1/users/me",
    asyncRoute(async (request, response) => {
      const auth = request.auth;
      if (!auth) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
      const role = primaryRole(auth);
      const profile = await loadOwnProfile(auth.userId, role);
      sendData(response, { id: auth.userId, roles: auth.roles, profile });
    }),
  );

  app.get(
    "/api/v1/users",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid pagination.");
      const { from, to } = paginationRange(parsed.data.page, parsed.data.limit);
      const { data, count, error } = await createAdminClient()
        .from("clinic_accounts")
        .select("id,user_id,display_name,role,is_active,created_at", { count: "exact" })
        .order("display_name")
        .range(from, to);
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load users.");
      sendCollection(
        response,
        data ?? [],
        paginationMeta(parsed.data.page, parsed.data.limit, count ?? 0),
      );
    }),
  );

  app.post(
    "/api/v1/rfid/lookup",
    requireRoles("admin", "doctor", "nurse"),
    asyncRoute(async (request, response) => {
      const parsed = rfidSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid RFID UID.");
      const { data, error } = await createAdminClient()
        .from("v_rfid_patient_profiles")
        .select(
          "patient_id,patient_type,first_name,last_name,identifier,department,profile_photo_url",
        )
        .eq("rfid_uid", parsed.data.rfidUid)
        .maybeSingle();
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to look up this card.");
      console.info(
        JSON.stringify({
          event: "rfid_lookup",
          found: Boolean(data),
          requestId: request.requestId,
          service: "identity-service",
          userId: request.auth?.userId,
        }),
      );
      sendData(response, data ?? null);
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Parses a bearer authorization value without trusting request-body identity.
function bearerToken(authorization: string | undefined): string {
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHENTICATED", "A valid access token is required.");
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "A valid access token is required.");
  return token;
}

// Resolves authorization roles only from protected role-assignment records.
async function resolveRoles(userId: string): Promise<ZentraqRole[]> {
  const { data, error } = await createAdminClient()
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to resolve user access.");
  const allowed = new Set<string>(ZENTRAQ_ROLES);
  const roles = (data as unknown as RoleRelation[] | null)?.flatMap((row) => {
    const relations = Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [];
    return relations.map((relation) => relation.name).filter((name) => allowed.has(name));
  });
  return [...new Set(roles ?? [])] as ZentraqRole[];
}

// Resolves one user to the minimum cross-service patient identifier.
async function resolvePatientReference(userId: string): Promise<{
  id: string;
  patientType: "student" | "faculty" | "staff";
} | null> {
  const admin = createAdminClient();
  const [student, faculty, staff] = await Promise.all([
    admin.from("students").select("id").eq("user_id", userId).maybeSingle(),
    admin.from("faculty").select("id").eq("user_id", userId).maybeSingle(),
    admin.from("staff").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  const error = student.error ?? faculty.error ?? staff.error;
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to resolve patient profile.");
  if (student.data) return { id: student.data.id, patientType: "student" };
  if (faculty.data) return { id: faculty.data.id, patientType: "faculty" };
  if (staff.data) return { id: staff.data.id, patientType: "staff" };
  return null;
}

// Loads the minimum profile fields appropriate to the user's protected role.
async function loadOwnProfile(userId: string, role: ZentraqRole): Promise<unknown> {
  const admin = createAdminClient();
  if (["admin", "doctor", "nurse"].includes(role)) {
    const { data, error } = await admin
      .from("clinic_accounts")
      .select("id,display_name,role,is_active,profile_photo_url")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle();
    if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load profile.");
    return data;
  }
  const table = role === "student" ? "students" : role === "faculty" ? "faculty" : "staff";
  const identifier = role === "student" ? "student_number" : "employee_number";
  const { data, error } = await admin
    .from(table)
    .select(`id,${identifier},first_name,last_name,department,status,profile_photo_url`)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load profile.");
  return data;
}
