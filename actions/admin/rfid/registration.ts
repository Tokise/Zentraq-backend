"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getUserRole } from "@/lib/auth/get-user-role";
import type { UserRole } from "@/lib/auth/roles";
import {
  preparePortalEmailChange,
  rollbackPortalEmailChange,
} from "@/lib/auth/sync-patient-portal-email";
import { logAuditEvent } from "@/lib/audit-logger";
import { checkPassword } from "@/lib/validation/password";
import { randomUUID } from "node:crypto";
import { assertSameOrigin } from "@/lib/security/action-guard";
import {
  removeProfilePhoto,
  resolveProfilePhotoUrl,
  uploadProfilePhoto,
} from "@/lib/storage/profile-photos";

const STUDENT_ID_PREFIX = "23011";
const MAX_PROFILE_PHOTO_BYTES = 150 * 1024;
const PROFILE_PHOTO_DATA_URL =
  /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const CLINIC_DEPARTMENT = "Clinic";
const CLINIC_LOGIN_ROLE_BY_POSITION: Record<string, UserRole> = {
  admin: "admin",
  doctor: "doctor",
  nurse: "nurse",
};
type ProfileRole = "student" | "faculty" | "staff";
type Profile = {
  id: string;
  role: ProfileRole;
  user_id: string | null;
  rfid_uid: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department: string | null;
  course: string | null;
  year_level: string | null;
  position: string | null;
  student_number: string | null;
  employee_number: string | null;
  clinic_photo_url: string | null;
  active_status: boolean;
};

// Validates department and position without trusting the registration controls.
function parseEmploymentDetails(
  role: ProfileRole,
  formData: FormData,
): {
  department: string | null;
  error: string | null;
  position: string | null;
} {
  const department = String(formData.get("department") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();

  if (role === "student") {
    return {
      department: department || null,
      error: null,
      position: null,
    };
  }

  if (!position) {
    return {
      department: department || null,
      error: "Position is required for faculty and staff profiles",
      position: null,
    };
  }

  if (role !== "staff" || department.toLowerCase() !== "clinic") {
    return {
      department: department || null,
      error: null,
      position,
    };
  }

  const loginRole = CLINIC_LOGIN_ROLE_BY_POSITION[position.toLowerCase()];
  if (!loginRole) {
    return {
      department: CLINIC_DEPARTMENT,
      error: "Clinic staff position must be Doctor, Nurse, or Admin",
      position: null,
    };
  }

  return {
    department: CLINIC_DEPARTMENT,
    error: null,
    position: loginRole[0].toUpperCase() + loginRole.slice(1),
  };
}

// Separates a Staff patient's profile role from the role used for login routing.
function getLoginRoleForProfile(profile: Profile): UserRole | null {
  if (profile.role !== "staff") return profile.role;
  if (profile.department?.trim().toLowerCase() !== "clinic") return "staff";
  return (
    CLINIC_LOGIN_ROLE_BY_POSITION[
      profile.position?.trim().toLowerCase() ?? ""
    ] ?? null
  );
}

// Requires an authenticated administrator for RFID account management.
async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || (await getUserRole(user.id)) !== "admin") return null;
  return user;
}

// Removes every partially-created portal identity row after an account failure.
async function rollbackPortalAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  await admin.from("clinic_accounts").delete().eq("user_id", userId);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("users").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}

// Validates a compact raster-image data URL before it reaches the database.
function parseProfilePhoto(value: FormDataEntryValue | null): {
  error: string | null;
  photoUrl: string | null;
} {
  const photoUrl = typeof value === "string" ? value.trim() : "";
  if (!photoUrl) return { error: null, photoUrl: null };
  if (!photoUrl.startsWith("data:")) {
    return { error: null, photoUrl: null };
  }

  const match = PROFILE_PHOTO_DATA_URL.exec(photoUrl);
  if (!match) {
    return {
      error: "Profile photos must be JPEG, PNG, or WebP image data.",
      photoUrl: null,
    };
  }

  const padding = match[1].endsWith("==") ? 2 : match[1].endsWith("=") ? 1 : 0;
  const byteLength = (match[1].length * 3) / 4 - padding;
  if (byteLength > MAX_PROFILE_PHOTO_BYTES) {
    return {
      error: "Profile photo must be 150 KB or smaller.",
      photoUrl: null,
    };
  }

  return { error: null, photoUrl };
}

// Normalizes student, faculty, and staff rows for the registration UI.
function normalizeProfile(
  row: Record<string, unknown>,
  role: ProfileRole,
): Profile {
  return {
    id: String(row.id),
    role,
    user_id: (row.user_id as string | null) ?? null,
    rfid_uid: String(row.rfid_uid ?? ""),
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    email: (row.email as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    course: role === "student" ? ((row.course as string | null) ?? null) : null,
    year_level:
      role === "student" && row.year_level != null
        ? String(row.year_level)
        : null,
    position:
      role !== "student" ? ((row.position as string | null) ?? null) : null,
    student_number:
      role === "student"
        ? ((row.student_number as string | null) ?? null)
        : null,
    employee_number:
      role !== "student"
        ? ((row.employee_number as string | null) ?? null)
        : null,
    clinic_photo_url: (row.profile_photo_url as string | null) ?? null,
    active_status: row.status === "active",
  };
}

// Normalizes a profile and signs a private photo path for short-lived display.
async function normalizeProfileWithPhoto(
  admin: ReturnType<typeof createAdminClient>,
  row: Record<string, unknown>,
  role: ProfileRole,
): Promise<Profile> {
  const profile = normalizeProfile(row, role);
  profile.clinic_photo_url = await resolveProfilePhotoUrl(
    admin,
    profile.clinic_photo_url,
  );
  return profile;
}

// Finds a profile without guessing the patient's role from form input.
async function findProfile(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<Profile | null> {
  const { data: student } = await admin
    .from("students")
    .select(
      "id, user_id, rfid_uid, first_name, last_name, email, department, course, year_level, student_number, profile_photo_url, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (student) return normalizeProfile(student, "student");
  const { data: faculty } = await admin
    .from("faculty")
    .select(
      "id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, profile_photo_url, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (faculty) return normalizeProfile(faculty, "faculty");
  const { data: staff } = await admin
    .from("staff")
    .select(
      "id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, profile_photo_url, status",
    )
    .eq("id", id)
    .maybeSingle();
  return staff ? normalizeProfile(staff, "staff") : null;
}

// Registers a profile in the table matching its requested role.
export async function registerStudentProfile(formData: FormData) {
  const actor = await requireAdmin();
  if (!actor) return { error: "Unauthorized" };
  if (!(await assertSameOrigin())) return { error: "Invalid request origin" };
  const requestedRole = String(formData.get("role") ?? "student");
  const role: ProfileRole =
    requestedRole === "faculty" || requestedRole === "staff"
      ? requestedRole
      : "student";
  const rfidUid = String(formData.get("rfidUid") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const identifier = String(
    formData.get(role === "student" ? "studentNumber" : "employeeNumber") ?? "",
  ).trim();
  if (!rfidUid || !firstName || !lastName || !identifier)
    return { error: "RFID UID, name, and ID number are required" };
  const employment = parseEmploymentDetails(role, formData);
  if (employment.error) return { error: employment.error };
  const admin = createAdminClient();
  const [{ data: studentRfid }, { data: facultyRfid }, { data: staffRfid }] =
    await Promise.all([
      admin.from("students").select("id").eq("rfid_uid", rfidUid).maybeSingle(),
      admin.from("faculty").select("id").eq("rfid_uid", rfidUid).maybeSingle(),
      admin.from("staff").select("id").eq("rfid_uid", rfidUid).maybeSingle(),
    ]);
  if (studentRfid || facultyRfid || staffRfid)
    return { error: "RFID card is already registered" };
  const email =
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase() || null;
  const shared = {
    rfid_uid: rfidUid,
    first_name: firstName,
    last_name: lastName,
    email,
    department: employment.department,
    status: "active",
  };
  const photo = parseProfilePhoto(formData.get("clinicPhotoUrl"));
  if (photo.error) return { error: photo.error };
  const profileId = randomUUID();
  const uploadedPhoto = photo.photoUrl
    ? await uploadProfilePhoto(admin, {
        dataUrl: photo.photoUrl,
        profileId,
        role,
      })
    : { error: null, path: null };
  if (uploadedPhoto.error) return { error: uploadedPhoto.error };
  const result =
    role === "student"
      ? await admin
          .from("students")
          .insert({
            id: profileId,
            ...shared,
            student_number: identifier,
            course: String(formData.get("course") ?? "").trim() || null,
            year_level: Number(formData.get("yearLevel")) || null,
            profile_photo_url: uploadedPhoto.path,
          })
          .select(
            "id, user_id, rfid_uid, first_name, last_name, email, department, course, year_level, student_number, profile_photo_url, status",
          )
          .single()
      : role === "faculty"
        ? await admin
            .from("faculty")
            .insert({
              id: profileId,
              ...shared,
              employee_number: identifier,
              position: employment.position,
              profile_photo_url: uploadedPhoto.path,
            })
            .select(
              "id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, profile_photo_url, status",
            )
            .single()
        : await admin
            .from("staff")
            .insert({
              id: profileId,
              ...shared,
              employee_number: identifier,
              position: employment.position,
              profile_photo_url: uploadedPhoto.path,
            })
            .select(
              "id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, profile_photo_url, status",
            )
            .single();
  if (result.error || !result.data) {
    await removeProfilePhoto(admin, uploadedPhoto.path);
    return { error: result.error?.message ?? "Unable to register profile" };
  }
  await logAuditEvent({
    action: "PATIENT_PROFILE_CREATED",
    userId: actor.id,
    email: actor.email,
    resource: result.data.id,
    details: { role },
  });
  revalidatePath("/admin/rfid-registration");
  return {
    success: true,
    data: await normalizeProfileWithPhoto(admin, result.data, role),
  };
}

// Updates a profile only in the table matching its recorded role.
export async function updateStudentProfile(formData: FormData) {
  const actor = await requireAdmin();
  if (!actor) return { error: "Unauthorized" };
  if (!(await assertSameOrigin())) return { error: "Invalid request origin" };

  const id = String(formData.get("profileId") ?? "").trim();
  const requestedRole = String(formData.get("role") ?? "student");
  const role: ProfileRole =
    requestedRole === "faculty" || requestedRole === "staff"
      ? requestedRole
      : "student";
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const identifier = String(
    formData.get(role === "student" ? "studentNumber" : "employeeNumber") ?? "",
  ).trim();
  if (!id || !firstName || !lastName || !identifier) {
    return { error: "Name and ID number are required" };
  }

  const employment = parseEmploymentDetails(role, formData);
  if (employment.error) return { error: employment.error };

  const admin = createAdminClient();
  const existingProfile = await findProfile(admin, id);
  if (!existingProfile || existingProfile.role !== role) {
    return { error: "Patient profile not found for the selected role" };
  }

  const photo = parseProfilePhoto(formData.get("clinicPhotoUrl"));
  if (photo.error) return { error: photo.error };
  const uploadedPhoto = photo.photoUrl
    ? await uploadProfilePhoto(admin, {
        dataUrl: photo.photoUrl,
        profileId: id,
        role,
      })
    : { error: null, path: null };
  if (uploadedPhoto.error) return { error: uploadedPhoto.error };

  const nextEmail =
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase() || null;
  const { change: emailChange, error: emailError } =
    await preparePortalEmailChange({
      currentProfileEmail: existingProfile.email,
      nextProfileEmail: nextEmail,
      userId: existingProfile.user_id,
    });
  if (emailError) {
    await removeProfilePhoto(admin, uploadedPhoto.path);
    return { error: emailError };
  }

  const shared = {
    first_name: firstName,
    last_name: lastName,
    email: nextEmail,
    department: employment.department,
  };
  const photoUpdate = uploadedPhoto.path
    ? { profile_photo_url: uploadedPhoto.path }
    : {};
  const result =
    role === "student"
      ? await admin
          .from("students")
          .update({
            ...shared,
            student_number: identifier,
            course: String(formData.get("course") ?? "").trim() || null,
            year_level: Number(formData.get("yearLevel")) || null,
            ...photoUpdate,
          })
          .eq("id", id)
          .select(
            "id, user_id, rfid_uid, first_name, last_name, email, department, course, year_level, student_number, profile_photo_url, status",
          )
          .single()
      : role === "faculty"
        ? await admin
            .from("faculty")
            .update({
              ...shared,
              employee_number: identifier,
              position: employment.position,
              ...photoUpdate,
            })
            .eq("id", id)
            .select(
              "id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, profile_photo_url, status",
            )
            .single()
        : await admin
            .from("staff")
            .update({
              ...shared,
              employee_number: identifier,
              position: employment.position,
              ...photoUpdate,
            })
            .eq("id", id)
            .select(
              "id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, profile_photo_url, status",
            )
            .single();
  const photoWasPersisted =
    !uploadedPhoto.path || result.data?.profile_photo_url === uploadedPhoto.path;
  if (result.error || !result.data || !photoWasPersisted) {
    await removeProfilePhoto(admin, uploadedPhoto.path);
    const rolledBack = await rollbackPortalEmailChange(emailChange);
    return {
      error: rolledBack
        ? (result.error?.message ?? "Unable to save the profile photo")
        : "The profile update failed and the login email could not be restored",
    };
  }
  if (uploadedPhoto.path) {
    await removeProfilePhoto(admin, existingProfile.clinic_photo_url);
  }
  await logAuditEvent({
    action: "PATIENT_PROFILE_UPDATED",
    userId: actor.id,
    email: actor.email,
    resource: id,
    details: { action: "PROFILE_UPDATED", role },
  });
  revalidatePath("/admin/rfid-registration");
  return {
    success: true,
    data: await normalizeProfileWithPhoto(admin, result.data, role),
  };
}

// Finds a profile by RFID across all patient roles.
export async function lookupStudentByRfid(formData: FormData) {
  const actor = await requireAdmin();
  if (!actor) return { error: "Unauthorized", data: null };
  const uid = String(formData.get("rfidUid") ?? "").trim();
  if (!uid) return { error: "RFID UID is required", data: null };
  const admin = createAdminClient();
  const { data: student } = await admin
    .from("students")
    .select(
      "id, user_id, rfid_uid, first_name, last_name, email, department, course, year_level, student_number, profile_photo_url, status",
    )
    .eq("rfid_uid", uid)
    .maybeSingle();
  if (student)
    return {
      error: null,
      data: await normalizeProfileWithPhoto(admin, student, "student"),
    };
  const { data: faculty } = await admin
    .from("faculty")
    .select(
      "id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, profile_photo_url, status",
    )
    .eq("rfid_uid", uid)
    .maybeSingle();
  if (faculty)
    return {
      error: null,
      data: await normalizeProfileWithPhoto(admin, faculty, "faculty"),
    };
  const { data: staff } = await admin
    .from("staff")
    .select(
      "id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, profile_photo_url, status",
    )
    .eq("rfid_uid", uid)
    .maybeSingle();
  return {
    error: null,
    data: staff
      ? await normalizeProfileWithPhoto(admin, staff, "staff")
      : null,
  };
}

export async function generateStudentId() {
  const actor = await requireAdmin();
  if (!actor) return { error: "Unauthorized" };
  const { data, error } = await createAdminClient()
    .from("students")
    .select("student_number")
    .like("student_number", `${STUDENT_ID_PREFIX}%`)
    .order("student_number", { ascending: false })
    .limit(1);
  if (error) return { error: error.message };
  const last =
    data?.[0]?.student_number?.slice(STUDENT_ID_PREFIX.length) ?? "0";
  const next = Number(last) + 1;
  if (next > 9999)
    return { error: "All student IDs in the configured range are taken." };
  return { success: true, suffix: String(next).padStart(4, "0") };
}

export async function createStudentAccount(formData: FormData) {
  const actor = await requireAdmin();
  if (!actor) return { error: "Unauthorized" };
  if (!(await assertSameOrigin())) return { error: "Invalid request origin" };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const profileId = String(formData.get("studentAccountId") ?? "").trim();
  if (!email || !profileId) {
    return {
      error: "Valid email and patient profile are required",
    };
  }
  const passwordCheck = checkPassword(password);
  if (!passwordCheck.valid) {
    return {
      error: `Password needs: ${passwordCheck.missing.join(", ")}`,
    };
  }

  const admin = createAdminClient();
  const profile = await findProfile(admin, profileId);
  if (!profile) return { error: "Patient profile not found" };
  if (profile.user_id) {
    return { error: "This profile already has a portal account" };
  }

  const loginRole = getLoginRoleForProfile(profile);
  if (!loginRole) {
    return { error: "Clinic staff position must be Doctor, Nurse, or Admin" };
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
    },
  );
  if (authError || !created.user) {
    return { error: authError?.message ?? "Unable to create login" };
  }

  const { data: roleRow, error: roleLookupError } = await admin
    .from("roles")
    .select("id")
    .eq("name", loginRole)
    .maybeSingle();
  if (roleLookupError || !roleRow) {
    await rollbackPortalAccount(admin, created.user.id);
    return {
      error:
        roleLookupError?.message ?? `The ${loginRole} role has not been seeded`,
    };
  }

  const { error: userError } = await admin.from("users").insert({
    id: created.user.id,
    email,
  });
  if (userError) {
    await rollbackPortalAccount(admin, created.user.id);
    return { error: userError.message };
  }

  const { error: assignmentError } = await admin.from("user_roles").insert({
    user_id: created.user.id,
    role_id: roleRow.id,
  });
  if (assignmentError) {
    await rollbackPortalAccount(admin, created.user.id);
    return { error: assignmentError.message };
  }

  if (["admin", "doctor", "nurse"].includes(loginRole)) {
    const { error: clinicAccountError } = await admin
      .from("clinic_accounts")
      .insert({
        user_id: created.user.id,
        role: loginRole,
        display_name: `${profile.first_name} ${profile.last_name}`.trim(),
        is_active: true,
      });
    if (clinicAccountError) {
      await rollbackPortalAccount(admin, created.user.id);
      return { error: clinicAccountError.message };
    }
  }

  const table =
    profile.role === "student"
      ? "students"
      : profile.role === "faculty"
        ? "faculty"
        : "staff";
  const { error: linkError } = await admin
    .from(table)
    .update({ user_id: created.user.id, email })
    .eq("id", profile.id);
  if (linkError) {
    await rollbackPortalAccount(admin, created.user.id);
    return { error: linkError.message };
  }

  await logAuditEvent({
    action: "PORTAL_ACCOUNT_CREATED",
    userId: actor.id,
    email: actor.email,
    resource: created.user.id,
    details: {
      profile_id: profile.id,
      patient_role: profile.role,
      login_role: loginRole,
    },
  });
  return { success: true, userId: created.user.id, email };
}
