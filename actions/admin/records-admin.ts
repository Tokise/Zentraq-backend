"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface StudentDocumentRow {
  id: string
  student_id: string
  document_type: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  uploaded_at: string
  student_name: string | null
  student_number: string | null
}

export async function getStudentDocumentsAction(patientId?: string): Promise<{
  error: string | null
  documents: StudentDocumentRow[]
}> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", documents: [] as StudentDocumentRow[] }

  const admin = createAdminClient()
  let query = admin
    .from("student_documents")
    .select(`
      id, student_id, document_type, file_url, file_name, mime_type, file_size, created_at,
      students(first_name, last_name, student_number)
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  if (patientId) query = query.eq("student_id", patientId)

  const { data, error } = await query
  if (error) return { error: error.message, documents: [] as StudentDocumentRow[] }

  const documents: StudentDocumentRow[] = (data ?? []).map((row: any) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students
    return {
      id: row.id,
      student_id: row.student_id,
      document_type: row.document_type,
      file_url: row.file_url,
      file_name: row.file_name,
      mime_type: row.mime_type,
      file_size: row.file_size,
      uploaded_at: row.created_at,
      student_name: student ? `${student.first_name} ${student.last_name}` : null,
      student_number: student?.student_number ?? null,
    }
  })

  return { error: null, documents }
}

export async function getEmergencyContactsAction(): Promise<{
  error: string | null
  contacts: Array<{
    id: string
    name: string
    role: string
    phone: string
    email: string | null
    location: string | null
  }>
}> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", contacts: [] }

  const admin = createAdminClient()
  const { data: settings, error: settingsError } = await admin
    .from("settings")
    .select("key, value")
    .eq("key", "clinic_info")
    .maybeSingle()

  if (settingsError) return { error: settingsError.message, contacts: [] }

  const clinic = settings?.value ?? {}
  const contacts = [
    {
      id: "clinic",
      name: String(clinic.name || "University Health Services Clinic"),
      role: "Clinic",
      phone: String(clinic.phone || "—"),
      email: String(clinic.email || null),
      location: String(clinic.address || null),
    },
    {
      id: "emergency",
      name: "Campus Emergency",
      role: "Emergency",
      phone: "9-1-1",
      email: null,
      location: "Campus-wide",
    },
    {
      id: "security",
      name: "Campus Security",
      role: "Security",
      phone: "8-7000",
      email: null,
      location: "Main Gate",
    },
  ]

  return { error: null, contacts }
}

export async function addStudentDocumentAction(params: {
  studentId: string
  documentType: string
  fileName: string
  fileUrl: string
  mimeType?: string
  fileSize?: number
}): Promise<{ success?: boolean; error?: string }> {
  const actor = await staff(["admin", "nurse"])
  if (!actor) return { error: "Access denied" }

  if (!params.studentId || !params.documentType || !params.fileUrl) {
    return { error: "Student, document type, and file are required" }
  }

  const { error } = await createAdminClient()
    .from("student_documents")
    .insert({
      student_id: params.studentId,
      document_type: params.documentType,
      file_url: params.fileUrl,
      file_name: params.fileName,
      mime_type: params.mimeType || null,
      file_size: params.fileSize || null,
      uploaded_by: actor.id,
    })

  if (error) return { error: error.message }
  return { success: true }
}