"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface DispensingLogRow {
  id: string
  prescription_id: string
  quantity: number
  dispensed_at: string
  medicine_name: string | null
  patient_name: string | null
  dispensed_by: string | null
}

export async function getDispensingLogsAction(): Promise<{
  error: string | null
  logs: DispensingLogRow[]
}> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", logs: [] as DispensingLogRow[] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("dispensing_logs")
    .select(`
      id, prescription_id, quantity, dispensed_at, dispensed_by,
      prescriptions(
        medicine_id,
        medicines(generic_name, brand_name),
        consultations(
          clinic_visits(
            students(first_name, last_name, student_number),
            faculty(first_name, last_name, employee_number)
          )
        )
      )
    `)
    .order("dispensed_at", { ascending: false })
    .limit(100)

  if (error) return { error: error.message, logs: [] as DispensingLogRow[] }

  const logs: DispensingLogRow[] = (data ?? []).map((row: any) => {
    const prescription = Array.isArray(row.prescriptions) ? row.prescriptions[0] : row.prescriptions
    const medicine = prescription && (Array.isArray(prescription.medicines) ? prescription.medicines[0] : prescription.medicines)
    const consultation = prescription && (Array.isArray(prescription.consultations) ? prescription.consultations[0] : prescription.consultations)
    const visit = consultation && (Array.isArray(consultation.clinic_visits) ? consultation.clinic_visits[0] : consultation.clinic_visits)
    const student = visit && (Array.isArray(visit.students) ? visit.students[0] : visit.students)
    const faculty = visit && (Array.isArray(visit.faculty) ? visit.faculty[0] : visit.faculty)
    const patientName = student
      ? `${student.first_name} ${student.last_name} (${student.student_number})`
      : faculty ? `${faculty.first_name} ${faculty.last_name} (${faculty.employee_number})` : null
    const medicineName = medicine
      ? `${medicine.generic_name}${medicine.brand_name ? ` (${medicine.brand_name})` : ""}`
      : null
    return {
      id: row.id,
      prescription_id: row.prescription_id,
      quantity: row.quantity,
      dispensed_at: row.dispensed_at,
      medicine_name: medicineName,
      patient_name: patientName,
      dispensed_by: row.dispensed_by,
    }
  })

  return { error: null, logs }
}

export async function getExpiringMedicinesAction(days = 90): Promise<{
  error: string | null
  items: Array<{
    id: string
    medicine_id: string
    medicine_name: string | null
    batch_number: string | null
    quantity: number
    expiry_date: string | null
    location: string | null
  }>
}> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", items: [] }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const { data, error } = await admin
    .from("medicine_stock")
    .select(`
      id, medicine_id, quantity, batch_number, expiry_date, location,
      medicines(generic_name, brand_name)
    `)
    .gt("quantity", 0)
    .not("expiry_date", "is", null)
    .lte("expiry_date", cutoff)
    .order("expiry_date", { ascending: true })
    .limit(100)

  if (error) return { error: error.message, items: [] }

  const items = (data ?? []).map((row: any) => {
    const medicine = Array.isArray(row.medicines) ? row.medicines[0] : row.medicines
    return {
      id: row.id,
      medicine_id: row.medicine_id,
      medicine_name: medicine ? `${medicine.generic_name}${medicine.brand_name ? ` (${medicine.brand_name})` : ""}` : null,
      batch_number: row.batch_number,
      quantity: row.quantity,
      expiry_date: row.expiry_date,
      location: row.location,
    }
  })

  return { error: null, items }
}
