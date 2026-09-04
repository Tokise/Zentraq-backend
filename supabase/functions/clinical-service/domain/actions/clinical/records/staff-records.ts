import { getActionActor, hasAnyRole } from "../../../../runtime/context.ts";
import { createAdminClient } from "../../../../runtime/context.ts";
import { logAuditEvent } from "../../../lib/audit-logger.ts";
import { resolveProfilePhotoUrl } from "../../../lib/storage/profile-photos.ts";

type StaffRole = "admin" | "doctor" | "nurse";

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

// Checks whether the authenticated clinician owns the target Staff profile.
async function isOwnStaffProfile(actorId: string, staffId: string) {
  const { data } = await createAdminClient()
    .from("staff")
    .select("user_id")
    .eq("id", staffId)
    .maybeSingle();
  return data?.user_id === actorId;
}

export interface StaffMedicalHistory {
  id: string;
  staff_id: string;
  condition_name: string;
  diagnosed_date: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StaffAllergy {
  id: string;
  staff_id: string;
  allergen: string;
  reaction: string | null;
  severity: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StaffMedication {
  id: string;
  staff_id: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  prescribed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface StaffImmunization {
  id: string;
  staff_id: string;
  vaccine_name: string;
  administered_date: string | null;
  dose_number: number | null;
  lot_number: string | null;
  administered_by: string | null;
  notes: string | null;
  created_at: string;
}

export async function getStaffMedicalHistoryAction(staffId: string) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", history: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("staff_medical_history")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, history: [] };
  return { error: null, history: (data || []) as StaffMedicalHistory[] };
}

export async function addStaffMedicalHistoryAction(
  staffId: string,
  data: {
    condition_name: string;
    diagnosed_date?: string;
    status?: string;
    notes?: string;
  },
) {
  const actor = await staff(["admin", "doctor"]);
  if (!actor) return { error: "Access denied", history: null };
  if (await isOwnStaffProfile(actor.id, staffId)) {
    return {
      error: "Clinicians cannot modify their own health record",
      history: null,
    };
  }

  const admin = createAdminClient();
  const { data: history, error } = await admin
    .from("staff_medical_history")
    .insert({ staff_id: staffId, ...data, created_by: actor.id })
    .select()
    .single();

  if (error) return { error: error.message, history: null };
  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: staffId,
    details: { condition: data.condition_name, action: "add_history" },
  });
  return { error: null, history };
}

export async function getStaffAllergiesAction(staffId: string) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", allergies: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("staff_allergies")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, allergies: [] };
  return { error: null, allergies: (data || []) as StaffAllergy[] };
}

export async function addStaffAllergyAction(
  staffId: string,
  data: {
    allergen: string;
    reaction?: string;
    severity?: string;
    notes?: string;
  },
) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", allergy: null };
  if (await isOwnStaffProfile(actor.id, staffId)) {
    return {
      error: "Clinicians cannot modify their own health record",
      allergy: null,
    };
  }

  const admin = createAdminClient();
  const { data: allergy, error } = await admin
    .from("staff_allergies")
    .insert({ staff_id: staffId, ...data, created_by: actor.id })
    .select()
    .single();

  if (error) return { error: error.message, allergy: null };
  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: staffId,
    details: { allergen: data.allergen, action: "add_allergy" },
  });
  return { error: null, allergy };
}

export async function getStaffMedicationsAction(staffId: string) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", medications: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("staff_medications")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, medications: [] };
  return { error: null, medications: (data || []) as StaffMedication[] };
}

export async function addStaffMedicationAction(
  staffId: string,
  data: {
    medicine_name: string;
    dosage?: string;
    frequency?: string;
    start_date?: string;
    end_date?: string;
    notes?: string;
  },
) {
  const actor = await staff(["admin", "doctor"]);
  if (!actor) return { error: "Access denied", medication: null };
  if (await isOwnStaffProfile(actor.id, staffId)) {
    return {
      error: "Clinicians cannot modify their own health record",
      medication: null,
    };
  }

  const admin = createAdminClient();
  const { data: medication, error } = await admin
    .from("staff_medications")
    .insert({ staff_id: staffId, ...data, prescribed_by: actor.id })
    .select()
    .single();

  if (error) return { error: error.message, medication: null };
  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: staffId,
    details: { medicine: data.medicine_name, action: "add_medication" },
  });
  return { error: null, medication };
}

export async function getStaffImmunizationsAction(staffId: string) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", immunizations: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("staff_immunizations")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, immunizations: [] };
  return { error: null, immunizations: (data || []) as StaffImmunization[] };
}

export async function addStaffImmunizationAction(
  staffId: string,
  data: {
    vaccine_name: string;
    administered_date?: string;
    dose_number?: number;
    lot_number?: string;
    notes?: string;
  },
) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", immunization: null };
  if (await isOwnStaffProfile(actor.id, staffId)) {
    return {
      error: "Clinicians cannot modify their own health record",
      immunization: null,
    };
  }

  const admin = createAdminClient();
  const { data: immunization, error } = await admin
    .from("staff_immunizations")
    .insert({ staff_id: staffId, ...data, administered_by: actor.id })
    .select()
    .single();

  if (error) return { error: error.message, immunization: null };
  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: staffId,
    details: { vaccine: data.vaccine_name, action: "add_immunization" },
  });
  return { error: null, immunization };
}

export interface StaffMedicalRecord {
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    department: string | null;
    position: string | null;
    email: string | null;
    phone: string | null;
    profile_photo_url: string | null;
  };
  history: StaffMedicalHistory[];
  allergies: StaffAllergy[];
  medications: StaffMedication[];
  immunizations: StaffImmunization[];
}

// Returns a staff member's clinical record for the Staff Health workspace.
export async function getStaffMedicalRecordAction(staffId: string) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", record: null };

  const admin = createAdminClient();
  const [
    { data: profile, error },
    history,
    allergies,
    medications,
    immunizations,
  ] = await Promise.all([
    admin
      .from("staff")
      .select(
        "id, first_name, last_name, employee_number, department, position, email, phone, profile_photo_url",
      )
      .eq("id", staffId)
      .maybeSingle(),
    getStaffMedicalHistoryAction(staffId),
    getStaffAllergiesAction(staffId),
    getStaffMedicationsAction(staffId),
    getStaffImmunizationsAction(staffId),
  ]);

  if (error || !profile) {
    return { error: error?.message ?? "Staff record not found", record: null };
  }
  if (
    history.error || allergies.error || medications.error || immunizations.error
  ) {
    return { error: "Unable to load the staff medical record", record: null };
  }

  const signedProfile = {
    ...profile,
    profile_photo_url: await resolveProfilePhotoUrl(
      admin,
      profile.profile_photo_url,
    ),
  };

  return {
    error: null,
    record: {
      profile: signedProfile,
      history: history.history,
      allergies: allergies.allergies,
      medications: medications.medications,
      immunizations: immunizations.immunizations,
    } as StaffMedicalRecord,
  };
}
