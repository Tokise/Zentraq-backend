"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface MedicalHistory {
  id: string
  condition: string
  diagnosed_date: string | null
  status: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Allergy {
  id: string
  allergen: string
  reaction: string | null
  severity: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Medication {
  id: string
  medicine_name: string
  dosage: string | null
  frequency: string | null
  start_date: string | null
  end_date: string | null
  prescribed_by: string | null
  notes: string | null
  created_at: string
}

export interface Immunization {
  id: string
  vaccine_name: string
  administered_date: string | null
  dose_number: number | null
  lot_number: string | null
  administered_by: string | null
  notes: string | null
  created_at: string
}

export interface PatientMedicalRecord {
  patient_id: string
  identifier: string
  first_name: string
  last_name: string
  middle_name: string | null
  department: string | null
  course: string | null
  year_level: number | null
  section: string | null
  birth_date: string | null
  gender: string | null
  blood_type: string | null
  phone: string | null
  email: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  guardian_name: string | null
  guardian_phone: string | null
  rfid_uid: string | null
  profile_photo_url: string | null
  patient_type: "student" | "faculty"
  medical_history: MedicalHistory[]
  allergies: Allergy[]
  medications: Medication[]
  immunizations: Immunization[]
}

export async function getPatientMedicalRecord(patientId: string, patientType: "student" | "faculty") {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", record: null as PatientMedicalRecord | null, records: [] as PatientMedicalRecord[] }

  const adminClient = createAdminClient()

  if (patientId === "all") {
    const { data, error } = await adminClient
      .from("v_patient_medical_record")
      .select("*")
      .eq("patient_type", patientType)

    if (error) return { error: error.message, record: null, records: [] }
    return { error: null, record: null, records: (data || []) as PatientMedicalRecord[] }
  }

  const { data, error } = await adminClient
    .from("v_patient_medical_record")
    .select("*")
    .eq("patient_id", patientId)
    .eq("patient_type", patientType)
    .maybeSingle()

  if (error) return { error: error.message, record: null, records: [] }

  if (data) {
    await logAuditEvent({
      userId: actor.id,
      action: "MEDICAL_RECORD_ACCESS",
      resource: patientId,
      details: {
        patient_id: patientId,
        patient_type: patientType
      }
    })
  }

  return { error: null, record: data as PatientMedicalRecord | null, records: data ? [data as PatientMedicalRecord] : [] }
}

export async function getOwnMedicalRecord() {
  const actor = await getActionActor()
  if (!actor) return { error: "Not authenticated", record: null as PatientMedicalRecord | null }

  const adminClient = createAdminClient()

  if (actor.role === "student") {
    const { data: studentData } = await adminClient
      .from("students")
      .select("id")
      .eq("user_id", actor.id)
      .maybeSingle()

    if (!studentData) return { error: "Student profile not found", record: null }

    const { data, error } = await adminClient
      .from("v_patient_medical_record")
      .select("*")
      .eq("patient_id", studentData.id)
      .eq("patient_type", "student")
      .maybeSingle()

    if (error) return { error: error.message, record: null }
    return { error: null, record: data as PatientMedicalRecord | null }
  }

  if (actor.role === "faculty" || actor.role === "staff") {
    const { data: facultyData } = await adminClient
      .from("faculty")
      .select("id")
      .eq("user_id", actor.id)
      .maybeSingle()

    if (!facultyData) return { error: "Faculty profile not found", record: null }

    const { data, error } = await adminClient
      .from("v_patient_medical_record")
      .select("*")
      .eq("patient_id", facultyData.id)
      .eq("patient_type", "faculty")
      .maybeSingle()

    if (error) return { error: error.message, record: null }
    return { error: null, record: data as PatientMedicalRecord | null }
  }

  return { error: "Access denied", record: null }
}

export async function addPatientAllergy(
  patientId: string,
  patientType: "student" | "faculty",
  data: { allergen: string; reaction?: string; severity?: string; notes?: string }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", allergy: null }

  const tableName = patientType === "student" ? "student_allergies" : "faculty_allergies"
  const idColumn = patientType === "student" ? "student_id" : "faculty_id"

  const { data: allergy, error } = await createAdminClient()
    .from(tableName)
    .insert({
      [idColumn]: patientId,
      allergen: data.allergen,
      reaction: data.reaction || null,
      severity: data.severity || null,
      notes: data.notes || null,
      created_by: actor.id
    })
    .select()
    .single()

  if (error) return { error: error.message, allergy: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: patientId,
    details: {
      allergen: data.allergen,
      patient_id: patientId,
      action: "add_allergy"
    }
  })

  return { error: null, allergy }
}

export async function updatePatientMedication(
  medicationId: string,
  patientType: "student" | "faculty",
  data: {
    medicine_name?: string
    dosage?: string
    frequency?: string
    start_date?: string
    end_date?: string
    notes?: string
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", medication: null }

  const tableName = patientType === "student" ? "student_medications" : "faculty_medications"

  const { data: medication, error } = await createAdminClient()
    .from(tableName)
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq("id", medicationId)
    .select()
    .single()

  if (error) return { error: error.message, medication: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: medicationId,
    details: {
      medication_id: medicationId,
      updates: data,
      action: "update_medication"
    }
  })

  return { error: null, medication }
}

export async function addPatientMedication(
  patientId: string,
  patientType: "student" | "faculty",
  data: {
    medicine_name: string
    dosage?: string
    frequency?: string
    start_date?: string
    end_date?: string
    notes?: string
  }
) {
  const actor = await staff(["admin", "doctor"])
  if (!actor) return { error: "Access denied - only doctors can prescribe", medication: null }

  const tableName = patientType === "student" ? "student_medications" : "faculty_medications"
  const idColumn = patientType === "student" ? "student_id" : "faculty_id"

  const { data: medication, error } = await createAdminClient()
    .from(tableName)
    .insert({
      [idColumn]: patientId,
      medicine_name: data.medicine_name,
      dosage: data.dosage || null,
      frequency: data.frequency || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      prescribed_by: actor.id,
      notes: data.notes || null
    })
    .select()
    .single()

  if (error) return { error: error.message, medication: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: patientId,
    details: {
      medication_id: medication.id,
      medicine_name: data.medicine_name,
      patient_id: patientId,
      action: "add_medication"
    }
  })

  return { error: null, medication }
}

export async function addPatientImmunization(
  patientId: string,
  patientType: "student" | "faculty",
  data: {
    vaccine_name: string
    administered_date?: string
    dose_number?: number
    lot_number?: string
    notes?: string
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", immunization: null }

  const tableName = patientType === "student" ? "student_immunizations" : "faculty_immunizations"
  const idColumn = patientType === "student" ? "student_id" : "faculty_id"

  const { data: immunization, error } = await createAdminClient()
    .from(tableName)
    .insert({
      [idColumn]: patientId,
      vaccine_name: data.vaccine_name,
      administered_date: data.administered_date || null,
      dose_number: data.dose_number || null,
      lot_number: data.lot_number || null,
      administered_by: actor.id,
      notes: data.notes || null
    })
    .select()
    .single()

  if (error) return { error: error.message, immunization: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: patientId,
    details: {
      immunization_id: immunization.id,
      vaccine_name: data.vaccine_name,
      patient_id: patientId,
      action: "add_immunization"
    }
  })

  return { error: null, immunization }
}

export async function addMedicalHistory(
  patientId: string,
  patientType: "student" | "faculty",
  data: {
    condition_name: string
    diagnosed_date?: string
    status?: string
    notes?: string
  }
) {
  const actor = await staff(["admin", "doctor"])
  if (!actor) return { error: "Access denied - only doctors can add medical history", history: null }

  const tableName = patientType === "student" ? "student_medical_history" : "faculty_medical_history"
  const idColumn = patientType === "student" ? "student_id" : "faculty_id"

  const { data: history, error } = await createAdminClient()
    .from(tableName)
    .insert({
      [idColumn]: patientId,
      condition_name: data.condition_name,
      diagnosed_date: data.diagnosed_date || null,
      status: data.status || "active",
      notes: data.notes || null,
      created_by: actor.id
    })
    .select()
    .single()

  if (error) return { error: error.message, history: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: patientId,
    details: {
      history_id: history.id,
      condition: data.condition_name,
      patient_id: patientId,
      action: "add_medical_history"
    }
  })

  return { error: null, history }
}

export async function updatePatientMedicalRecord(
  patientId: string,
  patientType: "student" | "faculty",
  data: {
    blood_type?: string | null
    height?: number | null
    weight?: number | null
    allergies?: string | null
    chronic_conditions?: string | null
    current_medications?: string | null
    notes?: string | null
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", record: null }

  const tableName = patientType === "student" ? "students" : "faculty"

  const { data: record, error } = await createAdminClient()
    .from(tableName)
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq("id", patientId)
    .select()
    .single()

  if (error) return { error: error.message, record: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: patientId,
    details: {
      patient_id: patientId,
      patient_type: patientType,
      updates: Object.keys(data),
      action: "update_medical_record"
    }
  })

  return { error: null, record }
}
