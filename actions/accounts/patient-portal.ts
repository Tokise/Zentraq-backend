"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserRole } from "@/lib/auth/get-user-role";
import { logAuditEvent } from "@/lib/audit-logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard";
import { checkPassword } from "@/lib/validation/password";
import { createAdminClient } from "@/utils/supabase/admin";

export type RecoveryAccountRole =
  | "student"
  | "faculty"
  | "staff"
  | "doctor"
  | "nurse";

export interface RecoveryAccountSearchResult {
  canReset: boolean;
  department: string | null;
  displayName: string;
  identifier: string | null;
  maskedEmail: string | null;
  role: RecoveryAccountRole;
  status: string;
  targetId: string;
}

export interface SearchRecoveryAccountsInput {
  query: string;
  role: RecoveryAccountRole;
}

export interface ResetPortalPasswordInput {
  newPassword: string;
  role: RecoveryAccountRole;
  targetId: string;
}

export interface ResetPortalPasswordResult {
  error?: string;
  maskedEmail?: string;
  success?: boolean;
}

interface PortalProfile {
  department: string | null;
  email: string | null;
  employee_number: string | null;
  first_name: string | null;
  id: string;
  last_name: string | null;
  status: string;
  student_number: string | null;
  user_id: string | null;
}

interface ClinicAccountRow {
  display_name: string;
  id: string;
  is_active: boolean;
  role: "doctor" | "nurse";
  user_id: string;
}

interface ResolvedRecoveryTarget {
  email: string | null;
  profileId: string | null;
  requiresProfileEmail: boolean;
  status: string;
  userId: string;
}

const recoveryRoleSchema = z.enum([
  "student",
  "faculty",
  "staff",
  "doctor",
  "nurse",
]);

const searchInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
  role: recoveryRoleSchema,
});

const resetInputSchema = z.object({
  newPassword: z.string(),
  role: recoveryRoleSchema,
  targetId: z.string().uuid(),
});

const SEARCH_LIMIT = 20;

// Returns a bounded, role-verified account directory for password recovery.
export async function searchRecoveryAccountsAction(
  input: SearchRecoveryAccountsInput,
): Promise<{
  accounts: RecoveryAccountSearchResult[];
  error?: string;
}> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { accounts: [], error: "Unauthorized" };
  }
  if (!(await assertSameOrigin())) {
    return { accounts: [], error: "Invalid request origin" };
  }

  const rate = checkRateLimit(
    `password-recovery-search:${actor.id}`,
    60,
    60 * 1000,
  );
  if (!rate.success) {
    return {
      accounts: [],
      error: "Too many searches. Please wait before trying again.",
    };
  }

  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      accounts: [],
      error: "Enter at least two characters to search.",
    };
  }

  const query = sanitizeSearchTerm(parsed.data.query);
  if (query.length < 2) {
    return {
      accounts: [],
      error: "Enter at least two letters or numbers to search.",
    };
  }

  if (parsed.data.role === "doctor" || parsed.data.role === "nurse") {
    return searchClinicianAccounts(parsed.data.role, query);
  }

  return searchPatientAccounts(parsed.data.role, query);
}

// Resets a verified portal password and revokes every prior app session.
export async function resetPortalPasswordAction(
  input: ResetPortalPasswordInput,
): Promise<ResetPortalPasswordResult> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { error: "Unauthorized" };
  }
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin" };
  }

  const rate = checkRateLimit(
    `password-recovery-reset:${actor.id}`,
    10,
    15 * 60 * 1000,
  );
  if (!rate.success) {
    return {
      error: "Too many password resets. Please wait before trying again.",
    };
  }

  const parsed = resetInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Select a valid account and enter a new password." };
  }

  const passwordCheck = checkPassword(parsed.data.newPassword);
  if (!passwordCheck.valid) {
    return {
      error: `Password needs: ${passwordCheck.missing.join(", ")}`,
    };
  }

  const targetResult = await resolveRecoveryTarget(
    parsed.data.role,
    parsed.data.targetId,
  );
  if (targetResult.error || !targetResult.target) {
    return { error: targetResult.error ?? "Account could not be verified." };
  }

  const target = targetResult.target;
  if (target.status.trim().toLowerCase() !== "active") {
    return { error: "Inactive accounts cannot receive a password reset." };
  }

  const assignedRole = await getUserRole(target.userId);
  if (assignedRole !== parsed.data.role) {
    return { error: "The selected account role could not be verified." };
  }

  const admin = createAdminClient();
  const { data: authData, error: authLookupError } =
    await admin.auth.admin.getUserById(target.userId);
  const authEmail = normalizeEmail(authData.user?.email ?? null);
  if (authLookupError || !authData.user || !authEmail) {
    return { error: "The linked login account could not be verified." };
  }
  if (target.requiresProfileEmail && !normalizeEmail(target.email)) {
    return {
      error: "The profile needs a login email before its password can be reset.",
    };
  }
  if (target.email && normalizeEmail(target.email) !== authEmail) {
    return {
      error:
        "The profile and login emails are out of sync. " +
        "Update the profile email first.",
    };
  }

  const { error: sessionError } = await admin
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", target.userId)
    .is("revoked_at", null);
  if (sessionError) {
    return { error: "Existing sessions could not be revoked." };
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(
    target.userId,
    { password: parsed.data.newPassword },
  );
  if (passwordError) {
    return { error: "The password could not be updated." };
  }

  await logAuditEvent({
    action: "AUTH_PASSWORD_RESET",
    userId: actor.id,
    email: actor.email,
    resource: target.userId,
    details: {
      profile_id: target.profileId,
      recovery_role: parsed.data.role,
      target_id: parsed.data.targetId,
    },
  });
  revalidatePath("/admin/useraccess/password_reset");
  return {
    success: true,
    maskedEmail: maskEmail(authEmail),
  };
}

// Searches one patient profile table and keeps only canonical role matches.
async function searchPatientAccounts(
  role: "student" | "faculty" | "staff",
  query: string,
): Promise<{
  accounts: RecoveryAccountSearchResult[];
  error?: string;
}> {
  const admin = createAdminClient();
  const table = role === "student" ? "students" : role;
  const lookupTerm = query.split(/\s+/)[0];
  const identifierColumn = role === "student" ? "student_number" : "employee_number";
  const selectColumns =
    role === "student"
      ? "id, user_id, first_name, last_name, email, student_number, department, status"
      : "id, user_id, first_name, last_name, email, employee_number, department, status";
  const { data, error } = await admin
    .from(table)
    .select(selectColumns)
    .or(
      [
        `first_name.ilike.%${lookupTerm}%`,
        `last_name.ilike.%${lookupTerm}%`,
        `email.ilike.%${lookupTerm}%`,
        `${identifierColumn}.ilike.%${lookupTerm}%`,
      ].join(","),
    )
    .order("last_name", { ascending: true })
    .limit(50);

  if (error) {
    return { accounts: [], error: "Unable to search accounts right now." };
  }

  const profiles = (data ?? []) as unknown as PortalProfile[];
  const roleMap = await getRoleMap(
    profiles.flatMap((profile) => (profile.user_id ? [profile.user_id] : [])),
  );
  const accounts = profiles
    .filter(
      (profile) =>
        Boolean(profile.user_id) &&
        roleMap.get(profile.user_id ?? "") === role &&
        profileMatchesQuery(profile, query),
    )
    .slice(0, SEARCH_LIMIT)
    .map((profile) => toPatientSearchResult(profile, role));

  return { accounts };
}

// Searches Doctor or Nurse accounts through clinic and linked staff records.
async function searchClinicianAccounts(
  role: "doctor" | "nurse",
  query: string,
): Promise<{
  accounts: RecoveryAccountSearchResult[];
  error?: string;
}> {
  const admin = createAdminClient();
  const { data: clinicData, error: clinicError } = await admin
    .from("clinic_accounts")
    .select("id, user_id, role, display_name, is_active")
    .eq("role", role)
    .eq("is_active", true)
    .order("display_name", { ascending: true })
    .limit(100);

  if (clinicError) {
    return { accounts: [], error: "Unable to search accounts right now." };
  }

  const clinicAccounts = (clinicData ?? []) as unknown as ClinicAccountRow[];
  const userIds = clinicAccounts.map((account) => account.user_id);
  let staffProfiles: PortalProfile[] = [];
  if (userIds.length > 0) {
    const { data, error } = await admin
      .from("staff")
      .select(
        "id, user_id, first_name, last_name, email, employee_number, department, status",
      )
      .in("user_id", userIds);
    if (error) {
      return { accounts: [], error: "Unable to search accounts right now." };
    }
    staffProfiles = (data ?? []) as unknown as PortalProfile[];
  }

  const staffByUserId = new Map(
    staffProfiles.flatMap((profile) =>
      profile.user_id ? [[profile.user_id, profile] as const] : [],
    ),
  );
  const authEmailEntries = await Promise.all(
    clinicAccounts.map(async (account) => {
      const { data } = await admin.auth.admin.getUserById(account.user_id);
      return [account.user_id, normalizeEmail(data.user?.email ?? null)] as const;
    }),
  );
  const authEmailByUserId = new Map(authEmailEntries);
  const roleMap = await getRoleMap(userIds);
  const normalizedQuery = query.toLocaleLowerCase("en-US");
  const accounts = clinicAccounts
    .filter((account) => {
      if (roleMap.get(account.user_id) !== role) return false;
      const profile = staffByUserId.get(account.user_id);
      return [
        account.display_name,
        profile ? formatName(profile.first_name, profile.last_name) : null,
        profile?.employee_number,
        profile?.email,
        authEmailByUserId.get(account.user_id),
      ].some((value) =>
        value
          ?.toLocaleLowerCase("en-US")
          .includes(normalizedQuery),
      );
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .slice(0, SEARCH_LIMIT)
    .map((account) =>
      toClinicianSearchResult(
        account,
        staffByUserId.get(account.user_id),
        authEmailByUserId.get(account.user_id) ?? null,
      ),
    );

  return { accounts };
}

// Resolves a submitted target again so the browser cannot forge account linkage.
async function resolveRecoveryTarget(
  role: RecoveryAccountRole,
  targetId: string,
): Promise<{
  error: string | null;
  target: ResolvedRecoveryTarget | null;
}> {
  if (role === "doctor" || role === "nurse") {
    return resolveClinicianTarget(role, targetId);
  }

  const admin = createAdminClient();
  const table = role === "student" ? "students" : role;
  const { data, error } = await admin
    .from(table)
    .select("id, user_id, email, status")
    .eq("id", targetId)
    .maybeSingle();
  const profile = data as Pick<
    PortalProfile,
    "email" | "id" | "status" | "user_id"
  > | null;

  if (error || !profile?.user_id) {
    return {
      error: "The selected account could not be verified.",
      target: null,
    };
  }

  return {
    error: null,
    target: {
      email: profile.email,
      profileId: profile.id,
      requiresProfileEmail: true,
      status: profile.status,
      userId: profile.user_id,
    },
  };
}

// Resolves an active clinician account and its optional staff profile.
async function resolveClinicianTarget(
  role: "doctor" | "nurse",
  targetId: string,
): Promise<{
  error: string | null;
  target: ResolvedRecoveryTarget | null;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clinic_accounts")
    .select("id, user_id, role, is_active")
    .eq("id", targetId)
    .eq("role", role)
    .eq("is_active", true)
    .maybeSingle();
  const account = data as Pick<
    ClinicAccountRow,
    "id" | "is_active" | "role" | "user_id"
  > | null;

  if (error || !account) {
    return {
      error: "The selected clinician account could not be verified.",
      target: null,
    };
  }

  const { data: staffProfile } = await admin
    .from("staff")
    .select("id, email")
    .eq("user_id", account.user_id)
    .maybeSingle();

  return {
    error: null,
    target: {
      email: staffProfile?.email ?? null,
      profileId: staffProfile?.id ?? null,
      requiresProfileEmail: false,
      status: "active",
      userId: account.user_id,
    },
  };
}

// Loads canonical roles for a bounded set of linked Auth users.
async function getRoleMap(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await createAdminClient()
    .from("user_roles")
    .select("user_id, role:roles(name)")
    .in("user_id", Array.from(new Set(userIds)));
  if (error) return new Map();

  return new Map(
    (data ?? []).flatMap((assignment) => {
      const relation = assignment.role as
        | { name?: string }
        | Array<{ name?: string }>
        | null;
      const resolvedRole = Array.isArray(relation) ? relation[0] : relation;
      return resolvedRole?.name
        ? [[assignment.user_id, resolvedRole.name] as const]
        : [];
    }),
  );
}

// Maps a patient profile into the minimized search-result contract.
function toPatientSearchResult(
  profile: PortalProfile,
  role: "student" | "faculty" | "staff",
): RecoveryAccountSearchResult {
  const status = profile.status?.trim().toLowerCase() || "unknown";
  return {
    canReset:
      status === "active" && Boolean(profile.user_id) && Boolean(profile.email),
    department: profile.department,
    displayName: formatName(profile.first_name, profile.last_name),
    identifier:
      role === "student" ? profile.student_number : profile.employee_number,
    maskedEmail: profile.email ? maskEmail(profile.email) : null,
    role,
    status,
    targetId: profile.id,
  };
}

// Maps a clinician and optional staff profile into a safe search result.
function toClinicianSearchResult(
  account: ClinicAccountRow,
  profile: PortalProfile | undefined,
  authEmail: string | null,
): RecoveryAccountSearchResult {
  const canReset = account.is_active && Boolean(authEmail);
  return {
    canReset,
    department: profile?.department ?? null,
    displayName:
      profile && (profile.first_name || profile.last_name)
        ? formatName(profile.first_name, profile.last_name)
        : account.display_name,
    identifier: profile?.employee_number ?? null,
    maskedEmail: profile?.email
      ? maskEmail(profile.email)
      : authEmail
        ? maskEmail(authEmail)
        : null,
    role: account.role,
    status: canReset ? "active" : "unlinked",
    targetId: account.id,
  };
}

// Checks a patient profile against the full normalized search phrase.
function profileMatchesQuery(profile: PortalProfile, query: string): boolean {
  const normalizedQuery = query.toLocaleLowerCase("en-US");
  return [
    formatName(profile.first_name, profile.last_name),
    profile.student_number,
    profile.employee_number,
    profile.email,
  ].some((value) =>
    value
      ?.toLocaleLowerCase("en-US")
      .includes(normalizedQuery),
  );
}

// Removes PostgREST filter control characters from a user search term.
function sanitizeSearchTerm(value: string): string {
  return value.replace(/[^\p{L}\p{N}@.+\-\s]/gu, "").trim();
}

// Formats a person's name while tolerating incomplete profile fields.
function formatName(
  firstName: string | null,
  lastName: string | null,
): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Unnamed account";
}

// Masks a login email before returning it to the administrator UI.
function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0) return "Email unavailable";

  const localPart = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  const visibleLocal = localPart.slice(0, Math.min(2, localPart.length));
  const hiddenLength = Math.max(1, localPart.length - visibleLocal.length);
  return `${visibleLocal}${"*".repeat(hiddenLength)}@${domain}`;
}

// Normalizes an optional email for safe equality checks.
function normalizeEmail(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}
