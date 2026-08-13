"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logAuditEvent } from "@/lib/audit-logger"
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
  type ActionActor,
} from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { resolveProfilePhotoUrl } from "@/lib/storage/profile-photos"

export type PatientProfileRole = "student" | "faculty" | "staff"
export type ClinicRole = "admin" | "doctor" | "nurse"
export type EmployeeComplianceStatus = "completed" | "due_soon" | "overdue"

const COMPLIANCE_BUCKET = "compliance-documents"
const SIGNED_URL_SECONDS = 5 * 60
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const PAGE_SIZE = 10
const CLINIC_ROLES = ["admin", "doctor", "nurse"] as const
const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
}

const patientRoleSchema = z.enum(["student", "faculty", "staff"])
const uuidSchema = z.string().uuid()
const searchSchema = z.object({
  scope: z.enum(["student", "employee"]),
  query: z.string().trim().max(100).default(""),
  page: z.number().int().min(1).max(10_000).default(1),
  position: z.string().trim().max(100).optional(),
  patientRole: z.enum(["faculty", "staff"]).optional(),
  department: z.string().trim().max(100).optional(),
}).refine(
  (input) =>
    [input.query, input.department, input.position].some(
      (value) => (value?.trim().length ?? 0) >= 2,
    ),
  {
    message: "Enter at least two characters in a search field",
    path: ["query"],
  },
)
const recordSchema = z.object({
  patientId: uuidSchema,
  patientRole: patientRoleSchema,
  accessMode: z.enum(["clinical", "own"]).default("clinical"),
})
const documentAccessSchema = recordSchema.extend({
  documentId: uuidSchema,
  category: z.enum(["annual_exam", "sick_leave", "general"]),
})
const examSchema = z.object({
  patientId: uuidSchema,
  patientRole: patientRoleSchema,
  schoolYear: z.string().trim().min(4).max(20).optional(),
  semester: z.string().trim().min(1).max(40).optional(),
  calendarYear: z.coerce.number().int().min(2000).max(2200).optional(),
  clinicalResultStatus: z
    .enum(["cleared", "pending", "not_cleared"])
    .optional(),
  examDetails: z.string().trim().min(1).max(4_000),
})
const sickLeaveSchema = z.object({
  patientId: uuidSchema,
  patientRole: z.enum(["faculty", "staff"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  reasonDiagnosis: z.string().trim().min(1).max(4_000),
})
const generalDocumentSchema = z.object({
  patientId: uuidSchema,
  patientRole: patientRoleSchema,
  documentType: z.string().trim().min(1).max(200),
})
const clinicalSectionSchema = z.discriminatedUnion("section", [
  recordSchema.extend({
    section: z.literal("history"),
    conditionName: z.string().trim().min(1).max(200),
    diagnosedDate: z.iso.date().optional(),
    status: z.enum(["active", "resolved", "chronic"]),
    notes: z.string().trim().max(2_000).optional(),
  }),
  recordSchema.extend({
    section: z.literal("allergy"),
    allergen: z.string().trim().min(1).max(200),
    reaction: z.string().trim().max(500).optional(),
    severity: z.enum(["mild", "moderate", "severe", "critical"]),
    notes: z.string().trim().max(1_000).optional(),
  }),
  recordSchema.extend({
    section: z.literal("medication"),
    medicineName: z.string().trim().min(1).max(200),
    dosage: z.string().trim().max(100).optional(),
    frequency: z.string().trim().max(100).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    notes: z.string().trim().max(1_000).optional(),
  }),
  recordSchema.extend({
    section: z.literal("immunization"),
    vaccineName: z.string().trim().min(1).max(200),
    administeredDate: z.iso.date().optional(),
    doseNumber: z.number().int().min(1).max(20).optional(),
    lotNumber: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(1_000).optional(),
  }),
])

export interface PatientSearchDTO {
  id: string
  role: PatientProfileRole
  identifier: string
  firstName: string
  lastName: string
  department: string | null
  position: string | null
  status: string
  createdAt: string
}

export interface PatientProfileDTO extends PatientSearchDTO {
  middleName: string | null
  course: string | null
  yearLevel: number | null
  email: string | null
  phone: string | null
  address: string | null
  birthDate: string | null
  gender: string | null
  bloodType: string | null
  profilePhotoUrl: string | null
}

export interface MedicalExamDTO {
  id: string
  schoolYear: string | null
  semester: string | null
  calendarYear: number | null
  clinicalResultStatus: "cleared" | "pending" | "not_cleared" | null
  examDetails: string
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
  downloadUrl: string
}

export interface SickLeaveDTO {
  id: string
  startDate: string
  endDate: string
  reasonDiagnosis: string
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
  downloadUrl: string
}

export interface ComplianceDocumentDTO {
  id: string
  category: "annual_exam" | "sick_leave" | "general"
  label: string
  fileName: string
  mimeType: string | null
  fileSize: number | null
  createdAt: string
  downloadUrl: string
}

export interface ClinicalHistoryDTO {
  id: string
  condition: string
  diagnosedDate: string | null
  status: string
  notes: string | null
  createdAt: string
}

export interface ClinicalAllergyDTO {
  id: string
  allergen: string
  reaction: string | null
  severity: string | null
  notes: string | null
  createdAt: string
}

export interface ClinicalMedicationDTO {
  id: string
  medicineName: string
  dosage: string | null
  frequency: string | null
  startDate: string | null
  endDate: string | null
  notes: string | null
  createdAt: string
}

export interface ClinicalImmunizationDTO {
  id: string
  vaccineName: string
  administeredDate: string | null
  doseNumber: number | null
  lotNumber: string | null
  notes: string | null
  createdAt: string
}

export interface ClinicalPrescriptionDTO {
  id: string
  medicineName: string
  dosage: string | null
  frequency: string | null
  durationDays: number | null
  quantity: number | null
  instructions: string | null
  status: string
  createdAt: string
}

export interface ClinicalConsultationDTO {
  id: string
  visitType: string
  checkedInAt: string
  completedAt: string | null
  patientComplaint: string | null
  vitalsDisposition: string
  vitalsSkipReason: string | null
  nurseName: string | null
  doctorName: string | null
  nurseHandoffNote: string | null
  nurseHandoffAt: string | null
  doctorReviewNote: string | null
  triage: {
    temperature: number | null
    bloodPressure: string | null
    heartRate: number | null
    respiratoryRate: number | null
    oxygenSaturation: number | null
    notes: string | null
  } | null
  diagnoses: Array<{ description: string | null; code: string | null }>
  treatments: Array<{
    plan: string | null
    instructions: string | null
  }>
  prescriptions: ClinicalPrescriptionDTO[]
  followUps: Array<{
    scheduledDate: string
    reason: string | null
    status: string
  }>
}

export interface ClinicalRecordDTO {
  medicalHistory: ClinicalHistoryDTO[]
  allergies: ClinicalAllergyDTO[]
  currentMedications: ClinicalMedicationDTO[]
  immunizations: ClinicalImmunizationDTO[]
  prescriptions: ClinicalPrescriptionDTO[]
  consultations: ClinicalConsultationDTO[]
}

export interface ComplianceRecordDTO {
  profile: PatientProfileDTO
  clinical: ClinicalRecordDTO
  exams: MedicalExamDTO[]
  sickLeave: SickLeaveDTO[]
  documents: ComplianceDocumentDTO[]
  employeeStatus: EmployeeComplianceStatus | null
}

type ProfileRow = {
  id: string
  user_id: string | null
  first_name: string
  last_name: string
  middle_name: string | null
  department: string | null
  course?: string | null
  year_level?: number | null
  position?: string | null
  student_number?: string
  employee_number?: string
  email: string | null
  phone: string | null
  address: string | null
  birth_date?: string | null
  gender?: string | null
  blood_type?: string | null
  profile_photo_url: string | null
  status: string
  created_at: string
}

type ExamRow = {
  id: string
  school_year: string | null
  semester: string | null
  calendar_year: number | null
  clinical_result_status: "cleared" | "pending" | "not_cleared" | null
  exam_details: string
  result_storage_path: string
  result_file_name: string
  result_mime_type: string
  result_file_size: number
  created_at: string
}

type SickLeaveRow = {
  id: string
  start_date: string
  end_date: string
  reason_diagnosis: string
  certificate_storage_path: string
  certificate_file_name: string
  certificate_mime_type: string
  certificate_file_size: number
  created_at: string
}

type GeneralDocumentRow = {
  id: string
  document_type: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  created_at: string
}

// Returns one page of minimized Student or Employee search results.
export async function searchPatientProfilesAction(input: unknown): Promise<{
  error: string | null
  data: PatientSearchDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const actor = await requireClinicActor()
  const parsed = searchSchema.safeParse(input)
  if (!actor || !parsed.success) {
    return emptySearchResult(
      parsed.success ? parsed.data.page : 1,
      actor && !parsed.success
        ? firstValidationError(parsed.error)
        : "Access denied",
    )
  }

  if (parsed.data.scope === "student") {
    return searchStudents(parsed.data)
  }

  return searchEmployees(parsed.data, actor.id)
}

// Resolves the signed-in user's patient profile independently of login role.
export async function getOwnPatientProfileAction(): Promise<{
  error: string | null
  profile: PatientProfileDTO | null
}> {
  const actor = await getActionActor()
  if (!actor) return { error: "Not authenticated", profile: null }

  const resolved = await resolvePatientProfileByUserId(actor.id)
  if (!resolved) return { error: "Patient profile not found", profile: null }

  return {
    error: null,
    profile: await toProfileDTO(resolved.row, resolved.role),
  }
}

// Returns one authorized patient's compliance record with short-lived links.
export async function getComplianceRecordAction(input: unknown): Promise<{
  error: string | null
  record: ComplianceRecordDTO | null
}> {
  const actor = await getActionActor()
  const parsed = recordSchema.safeParse(input)
  if (!actor || !parsed.success) {
    return { error: "Access denied", record: null }
  }

  const allowed = await canReadPatient(
    actor,
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  if (!allowed) return { error: "Access denied", record: null }

  const profileRow = await getProfileRow(
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  if (!profileRow) return { error: "Patient profile not found", record: null }
  if (
    parsed.data.accessMode === "clinical" &&
    hasAnyRole(actor, CLINIC_ROLES) &&
    profileRow.user_id === actor.id
  ) {
    return { error: "SELF_RECORD_REDIRECT", record: null }
  }

  const [compliance, clinical] = await Promise.all([
    loadComplianceData(parsed.data.patientId, parsed.data.patientRole),
    loadClinicalData(parsed.data.patientId, parsed.data.patientRole),
  ])
  const error = compliance.error ?? clinical.error
  if (error) return { error, record: null }

  await logAuditEvent({
    action: "MEDICAL_RECORD_ACCESS",
    userId: actor.id,
    email: actor.email,
    resource: parsed.data.patientId,
    details: { patient_role: parsed.data.patientRole },
  })

  return {
    error: null,
    record: {
      profile: await toProfileDTO(profileRow, parsed.data.patientRole),
      clinical: clinical.data,
      exams: compliance.exams,
      sickLeave: compliance.sickLeave,
      documents: compliance.documents,
      employeeStatus:
        parsed.data.patientRole === "student"
          ? null
          : getEmployeeComplianceStatus(compliance.exams),
    },
  }
}

// Returns an authorized patient's combined read-only document list.
export async function getAggregatedDocumentsAction(input: unknown): Promise<{
  error: string | null
  documents: ComplianceDocumentDTO[]
}> {
  const actor = await getActionActor()
  const parsed = recordSchema.safeParse(input)
  if (!actor || !parsed.success) return { error: "Access denied", documents: [] }

  const allowed = await canReadPatient(
    actor,
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  if (!allowed) return { error: "Access denied", documents: [] }

  return loadAggregatedDocuments(
    parsed.data.patientId,
    parsed.data.patientRole,
  )
}

// Generates a fresh short-lived URL after rechecking record ownership and role access.
export async function getComplianceDocumentUrlAction(input: unknown): Promise<{
  error: string | null
  url: string | null
  fileName: string | null
  mimeType: string | null
}> {
  const actor = await getActionActor()
  const parsed = documentAccessSchema.safeParse(input)
  if (!actor || !parsed.success) {
    return {
      error: "Access denied",
      url: null,
      fileName: null,
      mimeType: null,
    }
  }
  const allowed = await canReadPatient(
    actor,
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  if (!allowed) {
    return {
      error: "Access denied",
      url: null,
      fileName: null,
      mimeType: null,
    }
  }

  const admin = createAdminClient()
  const idColumn = `${parsed.data.patientRole}_id`
  let storagePath: string | null = null
  let bucket = COMPLIANCE_BUCKET
  let fileName: string | null = null
  let mimeType: string | null = null

  if (parsed.data.category === "annual_exam") {
    const { data } = await admin
      .from("medical_exam_results")
      .select("result_storage_path,result_file_name,result_mime_type")
      .eq("id", parsed.data.documentId)
      .eq(idColumn, parsed.data.patientId)
      .maybeSingle()
    storagePath = data?.result_storage_path ?? null
    fileName = data?.result_file_name ?? null
    mimeType = data?.result_mime_type ?? null
  } else if (parsed.data.category === "sick_leave") {
    const { data } = await admin
      .from("sick_leave_entries")
      .select(
        "certificate_storage_path,certificate_file_name,certificate_mime_type",
      )
      .eq("id", parsed.data.documentId)
      .eq(idColumn, parsed.data.patientId)
      .maybeSingle()
    storagePath = data?.certificate_storage_path ?? null
    fileName = data?.certificate_file_name ?? null
    mimeType = data?.certificate_mime_type ?? null
  } else {
    const { data } = await admin
      .from(`${parsed.data.patientRole}_documents`)
      .select("file_url,file_name,mime_type")
      .eq("id", parsed.data.documentId)
      .eq(idColumn, parsed.data.patientId)
      .maybeSingle()
    storagePath = data?.file_url ?? null
    fileName = data?.file_name ?? null
    mimeType = data?.mime_type ?? null
    bucket = `${parsed.data.patientRole}-documents`
  }

  if (!storagePath) {
    return {
      error: "Document not found",
      url: null,
      fileName: null,
      mimeType: null,
    }
  }
  if (/^https?:\/\//i.test(storagePath)) {
    return { error: null, url: storagePath, fileName, mimeType }
  }

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS)
  return {
    error: error?.message ?? null,
    url: data?.signedUrl ?? null,
    fileName,
    mimeType,
  }
}

// Adds one role-authorized clinical section after enforcing the self-treatment block.
export async function addClinicalSectionAction(
  input: unknown,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireClinicActor()
  const parsed = clinicalSectionSchema.safeParse(input)
  if (!actor || !parsed.success || !(await assertSameOrigin())) {
    return { error: parsed.success ? "Access denied" : firstValidationError(parsed.error) }
  }
  const profile = await getProfileRow(
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  if (!profile) return { error: "Patient profile not found" }
  if (profile.user_id === actor.id) {
    return { error: "Clinicians cannot modify their own health record" }
  }
  if (profile.user_id === actor.id) {
    return { error: "Clinicians cannot modify their own health record" }
  }
  const doctorLevel = actor.role === "admin" || actor.role === "doctor"
  if (
    (parsed.data.section === "history" ||
      parsed.data.section === "medication") &&
    !doctorLevel
  ) {
    return { error: "Doctor or Admin access is required" }
  }

  const idColumn = `${parsed.data.patientRole}_id`
  const tablePrefix = parsed.data.patientRole
  let table: string
  let values: Record<string, unknown>
  if (parsed.data.section === "history") {
    table = `${tablePrefix}_medical_history`
    values = {
      [idColumn]: parsed.data.patientId,
      condition_name: parsed.data.conditionName,
      diagnosed_date: parsed.data.diagnosedDate ?? null,
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
      created_by: actor.id,
    }
  } else if (parsed.data.section === "allergy") {
    table = `${tablePrefix}_allergies`
    values = {
      [idColumn]: parsed.data.patientId,
      allergen: parsed.data.allergen,
      reaction: parsed.data.reaction ?? null,
      severity: parsed.data.severity,
      notes: parsed.data.notes ?? null,
      created_by: actor.id,
    }
  } else if (parsed.data.section === "medication") {
    if (
      parsed.data.startDate &&
      parsed.data.endDate &&
      parsed.data.endDate < parsed.data.startDate
    ) {
      return { error: "Medication end date cannot be before its start date" }
    }
    table = `${tablePrefix}_medications`
    values = {
      [idColumn]: parsed.data.patientId,
      medicine_name: parsed.data.medicineName,
      dosage: parsed.data.dosage ?? null,
      frequency: parsed.data.frequency ?? null,
      start_date: parsed.data.startDate ?? null,
      end_date: parsed.data.endDate ?? null,
      notes: parsed.data.notes ?? null,
      prescribed_by: actor.id,
    }
  } else {
    table = `${tablePrefix}_immunizations`
    values = {
      [idColumn]: parsed.data.patientId,
      vaccine_name: parsed.data.vaccineName,
      administered_date: parsed.data.administeredDate ?? null,
      dose_number: parsed.data.doseNumber ?? null,
      lot_number: parsed.data.lotNumber ?? null,
      notes: parsed.data.notes ?? null,
      administered_by: actor.id,
    }
  }

  const { error } = await createAdminClient().from(table).insert(values)
  if (error) return { error: error.message }
  await logAuditEvent({
    action: "MEDICAL_RECORD_MODIFY",
    userId: actor.id,
    email: actor.email,
    resource: parsed.data.patientId,
    details: {
      patient_role: parsed.data.patientRole,
      section: parsed.data.section,
    },
  })
  revalidateRecordRoutes()
  return { success: true }
}

// Uploads an Annual Medical Exam result after Admin or Doctor validation.
export async function uploadMedicalExamAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await getActionActor()
  if (
    !actor ||
    !hasAnyRole(actor, ["admin", "doctor"]) ||
    !(await assertSameOrigin())
  ) {
    return { error: "Access denied" }
  }

  const parsed = examSchema.safeParse({
    patientId: formData.get("patientId"),
    patientRole: formData.get("patientRole"),
    schoolYear: optionalFormValue(formData.get("schoolYear")),
    semester: optionalFormValue(formData.get("semester")),
    calendarYear: optionalFormValue(formData.get("calendarYear")),
    clinicalResultStatus: optionalFormValue(
      formData.get("clinicalResultStatus"),
    ),
    examDetails: formData.get("examDetails"),
  })
  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  const fieldError = validateExamRoleFields(parsed.data)
  if (fieldError) return { error: fieldError }

  const file = formData.get("file")
  const fileError = validateComplianceFile(file)
  if (fileError) return { error: fileError }
  if (!(file instanceof File)) return { error: "A result file is required" }

  const profile = await getProfileRow(
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  if (!profile) return { error: "Patient profile not found" }
  if (profile.user_id === actor.id) {
    return { error: "Clinicians cannot modify their own health record" }
  }

  const storagePath = buildStoragePath(
    parsed.data.patientRole,
    parsed.data.patientId,
    "annual-exams",
    file.type,
  )
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(COMPLIANCE_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) return { error: uploadError.message }

  const patientColumns = getPatientColumns(
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  const { error: insertError } = await admin
    .from("medical_exam_results")
    .insert({
      ...patientColumns,
      school_year:
        parsed.data.patientRole === "student"
          ? parsed.data.schoolYear
          : null,
      semester:
        parsed.data.patientRole === "student" ? parsed.data.semester : null,
      calendar_year:
        parsed.data.patientRole === "student"
          ? null
          : parsed.data.calendarYear,
      clinical_result_status:
        parsed.data.patientRole === "student"
          ? parsed.data.clinicalResultStatus
          : null,
      exam_details: parsed.data.examDetails,
      result_storage_path: storagePath,
      result_file_name: file.name,
      result_mime_type: file.type,
      result_file_size: file.size,
      uploaded_by: actor.id,
    })

  if (insertError) {
    await admin.storage.from(COMPLIANCE_BUCKET).remove([storagePath])
    return { error: insertError.message }
  }

  await recordComplianceAudit(actor, parsed.data.patientId, "annual_exam")
  revalidateRecordRoutes()
  return { success: true }
}

// Uploads one private generic document for a Student, Faculty, or Staff record.
export async function uploadGeneralDocumentAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await getActionActor()
  if (
    !actor ||
    !hasAnyRole(actor, ["admin", "doctor"]) ||
    !(await assertSameOrigin())
  ) {
    return { error: "Access denied" }
  }

  const parsed = generalDocumentSchema.safeParse({
    patientId: formData.get("patientId"),
    patientRole: formData.get("patientRole"),
    documentType: formData.get("documentType"),
  })
  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  const file = formData.get("file")
  const fileError = validateComplianceFile(file)
  if (fileError) return { error: fileError }
  if (!(file instanceof File)) return { error: "A document file is required" }

  const profile = await getProfileRow(
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  if (!profile) return { error: "Patient profile not found" }
  if (profile.user_id === actor.id) {
    return { error: "Clinicians cannot modify their own health record" }
  }

  const bucket = `${parsed.data.patientRole}-documents`
  const table = `${parsed.data.patientRole}_documents`
  const idColumn = `${parsed.data.patientRole}_id`
  const storagePath =
    `${parsed.data.patientId}/${crypto.randomUUID()}.` +
    MIME_EXTENSION[file.type]
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) return { error: uploadError.message }

  const { error: insertError } = await admin.from(table).insert({
    [idColumn]: parsed.data.patientId,
    document_type: parsed.data.documentType,
    file_url: storagePath,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: actor.id,
  })
  if (insertError) {
    await admin.storage.from(bucket).remove([storagePath])
    return { error: insertError.message }
  }

  await recordComplianceAudit(
    actor,
    parsed.data.patientId,
    "general_document",
  )
  revalidateRecordRoutes()
  return { success: true }
}

// Uploads a Faculty or Staff Sick Leave certificate for a clinic user.
export async function uploadSickLeaveAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireClinicActor()
  if (!actor || !(await assertSameOrigin())) return { error: "Access denied" }

  const parsed = sickLeaveSchema.safeParse({
    patientId: formData.get("patientId"),
    patientRole: formData.get("patientRole"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reasonDiagnosis: formData.get("reasonDiagnosis"),
  })
  if (!parsed.success) return { error: firstValidationError(parsed.error) }
  if (parsed.data.endDate < parsed.data.startDate) {
    return { error: "End date must be on or after the start date" }
  }

  const file = formData.get("file")
  const fileError = validateComplianceFile(file)
  if (fileError) return { error: fileError }
  if (!(file instanceof File)) return { error: "A certificate file is required" }

  const profile = await getProfileRow(
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  if (!profile) return { error: "Patient profile not found" }

  const storagePath = buildStoragePath(
    parsed.data.patientRole,
    parsed.data.patientId,
    "sick-leave",
    file.type,
  )
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(COMPLIANCE_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) return { error: uploadError.message }

  const patientColumns = getPatientColumns(
    parsed.data.patientId,
    parsed.data.patientRole,
  )
  const { error: insertError } = await admin
    .from("sick_leave_entries")
    .insert({
      ...patientColumns,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      reason_diagnosis: parsed.data.reasonDiagnosis,
      certificate_storage_path: storagePath,
      certificate_file_name: file.name,
      certificate_mime_type: file.type,
      certificate_file_size: file.size,
      authored_by: actor.id,
    })

  if (insertError) {
    await admin.storage.from(COMPLIANCE_BUCKET).remove([storagePath])
    return { error: insertError.message }
  }

  await recordComplianceAudit(actor, parsed.data.patientId, "sick_leave")
  revalidateRecordRoutes()
  return { success: true }
}

// Requires an authenticated Admin, Doctor, or Nurse.
async function requireClinicActor(): Promise<ActionActor | null> {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, CLINIC_ROLES) ? actor : null
}

// Returns an empty paginated response with a stable shape.
function emptySearchResult(page: number, error: string) {
  return {
    error,
    data: [] as PatientSearchDTO[],
    total: 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  }
}

// Searches Student profiles with database-side paging.
async function searchStudents(
  input: z.infer<typeof searchSchema>,
): Promise<{
  error: string | null
  data: PatientSearchDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const admin = createAdminClient()
  const start = (input.page - 1) * PAGE_SIZE
  let query = admin
    .from("students")
    .select(
      "id,student_number,first_name,last_name,department,status,created_at",
      { count: "exact" },
    )

  if (input.query) {
    const term = sanitizeSearchTerm(input.query)
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,student_number.ilike.%${term}%`,
    )
  }

  if (input.department) query = query.eq("department", input.department)
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1)
  if (error) return emptySearchResult(input.page, error.message)

  const rows = (data ?? []) as Array<{
    id: string
    student_number: string
    first_name: string
    last_name: string
    department: string | null
    status: string
    created_at: string
  }>
  const total = count ?? 0
  return {
    error: null,
    data: rows.map((row) => ({
      id: row.id,
      role: "student",
      identifier: row.student_number,
      firstName: row.first_name,
      lastName: row.last_name,
      department: row.department,
      position: null,
      status: row.status,
      createdAt: row.created_at,
    })),
    total,
    page: input.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  }
}

// Searches Faculty and Staff profiles and merges them newest first.
async function searchEmployees(
  input: z.infer<typeof searchSchema>,
  actorId: string,
): Promise<{
  error: string | null
  data: PatientSearchDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const includeFaculty = !input.patientRole || input.patientRole === "faculty"
  const includeStaff = !input.patientRole || input.patientRole === "staff"
  const fetchLimit = input.page * PAGE_SIZE
  const [facultyResult, staffResult] = await Promise.all([
    includeFaculty
      ? queryEmployeeTable("faculty", input, fetchLimit, actorId)
      : Promise.resolve({ error: null, rows: [], count: 0 }),
    includeStaff
      ? queryEmployeeTable("staff", input, fetchLimit, actorId)
      : Promise.resolve({ error: null, rows: [], count: 0 }),
  ])
  const error = facultyResult.error ?? staffResult.error
  if (error) return emptySearchResult(input.page, error)

  const start = (input.page - 1) * PAGE_SIZE
  const combined = [...facultyResult.rows, ...staffResult.rows]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(start, start + PAGE_SIZE)
  const total = facultyResult.count + staffResult.count
  return {
    error: null,
    data: combined,
    total,
    page: input.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  }
}

// Queries a single Employee profile table with the shared filters.
async function queryEmployeeTable(
  role: "faculty" | "staff",
  input: z.infer<typeof searchSchema>,
  limit: number,
  actorId: string,
) {
  const admin = createAdminClient()
  let query = admin
    .from(role)
    .select(
      "id,employee_number,first_name,last_name,department,position,status,created_at",
      { count: "exact" },
    )
    .neq("user_id", actorId)

  if (input.query) {
    const term = sanitizeSearchTerm(input.query)
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_number.ilike.%${term}%`,
    )
  }
  if (input.position) query = query.ilike("position", `%${input.position}%`)
  if (input.department) query = query.eq("department", input.department)

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return { error: error.message, rows: [], count: 0 }

  const rows = (data ?? []) as Array<{
    id: string
    employee_number: string
    first_name: string
    last_name: string
    department: string | null
    position: string | null
    status: string
    created_at: string
  }>
  return {
    error: null,
    rows: rows.map((row) => ({
      id: row.id,
      role,
      identifier: row.employee_number,
      firstName: row.first_name,
      lastName: row.last_name,
      department: row.department,
      position: row.position,
      status: row.status,
      createdAt: row.created_at,
    } satisfies PatientSearchDTO)),
    count: count ?? 0,
  }
}

// Removes PostgREST filter-control characters from a search term.
function sanitizeSearchTerm(value: string): string {
  return value.replace(/[%_,().]/g, " ").trim()
}

// Resolves exactly one profile linked to the supplied Auth user.
async function resolvePatientProfileByUserId(userId: string): Promise<{
  role: PatientProfileRole
  row: ProfileRow
} | null> {
  const admin = createAdminClient()
  const select = profileSelect()
  const [student, faculty, staff] = await Promise.all([
    admin.from("students").select(select.student).eq("user_id", userId).maybeSingle(),
    admin.from("faculty").select(select.employee).eq("user_id", userId).maybeSingle(),
    admin.from("staff").select(select.employee).eq("user_id", userId).maybeSingle(),
  ])
  if (student.data) {
    return { role: "student", row: student.data as unknown as ProfileRow }
  }
  if (faculty.data) {
    return { role: "faculty", row: faculty.data as unknown as ProfileRow }
  }
  if (staff.data) {
    return { role: "staff", row: staff.data as unknown as ProfileRow }
  }
  return null
}

// Determines whether an actor may read the requested patient's record.
async function canReadPatient(
  actor: ActionActor,
  patientId: string,
  patientRole: PatientProfileRole,
): Promise<boolean> {
  if (hasAnyRole(actor, CLINIC_ROLES)) return true
  const ownProfile = await resolvePatientProfileByUserId(actor.id)
  return ownProfile?.role === patientRole && ownProfile.row.id === patientId
}

// Loads a minimized profile row from the role-owned table.
async function getProfileRow(
  patientId: string,
  patientRole: PatientProfileRole,
): Promise<ProfileRow | null> {
  const select = profileSelect()
  const columns = patientRole === "student" ? select.student : select.employee
  const profileTable = patientRole === "student" ? "students" : patientRole
  const { data } = await createAdminClient()
    .from(profileTable)
    .select(columns)
    .eq("id", patientId)
    .maybeSingle()
  return (data as ProfileRow | null) ?? null
}

// Provides role-specific profile projections without RFID or guardian fields.
function profileSelect() {
  return {
    student:
      "id,user_id,student_number,first_name,last_name,middle_name,department,course,year_level,email,phone,address,birth_date,gender,blood_type,profile_photo_url,status,created_at",
    employee:
      "id,user_id,employee_number,first_name,last_name,middle_name,department,position,email,phone,address,profile_photo_url,status,created_at",
  }
}

// Converts a database profile into the explicit client DTO.
async function toProfileDTO(
  row: ProfileRow,
  role: PatientProfileRole,
): Promise<PatientProfileDTO> {
  return {
    id: row.id,
    role,
    identifier:
      role === "student"
        ? row.student_number ?? ""
        : row.employee_number ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    department: row.department,
    course: role === "student" ? row.course ?? null : null,
    yearLevel: role === "student" ? row.year_level ?? null : null,
    position: role === "student" ? null : row.position ?? null,
    email: row.email,
    phone: row.phone,
    address: row.address,
    birthDate: role === "student" ? row.birth_date ?? null : null,
    gender: role === "student" ? row.gender ?? null : null,
    bloodType: role === "student" ? row.blood_type ?? null : null,
    profilePhotoUrl: await resolveProfilePhotoUrl(
      createAdminClient(),
      row.profile_photo_url,
    ),
    status: row.status,
    createdAt: row.created_at,
  }
}

// Loads minimized clinical sections directly from the role-owned patient tables.
async function loadClinicalData(
  patientId: string,
  patientRole: PatientProfileRole,
): Promise<{ error: string | null; data: ClinicalRecordDTO }> {
  const empty: ClinicalRecordDTO = {
    medicalHistory: [],
    allergies: [],
    currentMedications: [],
    immunizations: [],
    prescriptions: [],
    consultations: [],
  }
  const admin = createAdminClient()
  const idColumn = `${patientRole}_id`
  const tablePrefix = patientRole
  const [historyResult, allergyResult, medicationResult, immunizationResult, visitResult] =
    await Promise.all([
      admin
        .from(`${tablePrefix}_medical_history`)
        .select("id,condition_name,diagnosed_date,status,notes,created_at")
        .eq(idColumn, patientId)
        .order("created_at", { ascending: false }),
      admin
        .from(`${tablePrefix}_allergies`)
        .select("id,allergen,reaction,severity,notes,created_at")
        .eq(idColumn, patientId)
        .order("created_at", { ascending: false }),
      admin
        .from(`${tablePrefix}_medications`)
        .select(
          "id,medicine_name,dosage,frequency,start_date,end_date,notes,created_at",
        )
        .eq(idColumn, patientId)
        .order("created_at", { ascending: false }),
      admin
        .from(`${tablePrefix}_immunizations`)
        .select(
          "id,vaccine_name,administered_date,dose_number,lot_number,notes,created_at",
        )
        .eq(idColumn, patientId)
        .order("administered_date", { ascending: false }),
      admin
        .from("clinic_visits")
        .select(`
          visit_type,
          check_in_time,
          consultations(
            id,
            status,
            completed_at,
            patient_complaint,
            vitals_disposition,
            vitals_skip_reason,
            nurse_handoff_note,
            nurse_handoff_at,
            doctor_review_note,
            doctor:clinic_accounts!consultations_doctor_id_fkey(display_name),
            nurse:clinic_accounts!consultations_nurse_id_fkey(display_name),
            triage_assessments(
              temperature,
              blood_pressure,
              heart_rate,
              respiratory_rate,
              oxygen_saturation,
              notes
            ),
            diagnoses(icd10_code,description),
            treatments(treatment_plan,instructions),
            prescriptions(
              id,
              dosage,
              frequency,
              duration_days,
              quantity,
              instructions,
              status,
              created_at,
              medicines(generic_name,brand_name)
            ),
            follow_ups(scheduled_date,reason,status)
          )
        `)
        .eq(idColumn, patientId),
    ])
  const baseError =
    historyResult.error?.message ??
    allergyResult.error?.message ??
    medicationResult.error?.message ??
    immunizationResult.error?.message ??
    visitResult.error?.message
  if (baseError) return { error: baseError, data: empty }

  type Relation<T> = T | T[] | null
  interface ConsultationTimelineRow {
    id: string
    status: string
    completed_at: string | null
    patient_complaint: string | null
    vitals_disposition: string
    vitals_skip_reason: string | null
    nurse_handoff_note: string | null
    nurse_handoff_at: string | null
    doctor_review_note: string | null
    doctor: Relation<{ display_name: string | null }>
    nurse: Relation<{ display_name: string | null }>
    triage_assessments: Relation<{
      temperature: number | null
      blood_pressure: string | null
      heart_rate: number | null
      respiratory_rate: number | null
      oxygen_saturation: number | null
      notes: string | null
    }>
    diagnoses: Array<{
      icd10_code: string | null
      description: string | null
    }> | null
    treatments: Array<{
      treatment_plan: string | null
      instructions: string | null
    }> | null
    prescriptions: Array<{
      id: string
      dosage: string | null
      frequency: string | null
      duration_days: number | null
      quantity: number | null
      instructions: string | null
      status: string
      created_at: string
      medicines: Relation<{
        generic_name: string
        brand_name: string | null
      }>
    }> | null
    follow_ups: Array<{
      scheduled_date: string
      reason: string | null
      status: string
    }> | null
  }
  const visitRows = (visitResult.data ?? []) as unknown as Array<{
    visit_type: string
    check_in_time: string
    consultations:
      | ConsultationTimelineRow
      | ConsultationTimelineRow[]
      | null
  }>
  const completedConsultations = visitRows.flatMap((visit) => {
    const relation = visit.consultations
    const consultations = Array.isArray(relation)
      ? relation
      : relation
        ? [relation]
        : []
    return consultations
      .filter((consultation) => consultation.status === "completed")
      .map((consultation) => ({
        consultation,
        checkedInAt: visit.check_in_time,
        visitType: visit.visit_type,
      }))
  })
  const consultationIds = completedConsultations.map(
    ({ consultation }) => consultation.id,
  )
  const prescriptionResult = consultationIds.length
    ? await admin
        .from("prescriptions")
        .select(
          "id,dosage,frequency,duration_days,quantity,instructions,status,created_at,medicines(generic_name,brand_name)",
        )
        .in("consultation_id", consultationIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null }
  if (prescriptionResult.error) {
    return { error: prescriptionResult.error.message, data: empty }
  }

  const historyRows = (historyResult.data ?? []) as Array<{
    id: string
    condition_name: string
    diagnosed_date: string | null
    status: string
    notes: string | null
    created_at: string
  }>
  const allergyRows = (allergyResult.data ?? []) as Array<{
    id: string
    allergen: string
    reaction: string | null
    severity: string | null
    notes: string | null
    created_at: string
  }>
  const medicationRows = (medicationResult.data ?? []) as Array<{
    id: string
    medicine_name: string
    dosage: string | null
    frequency: string | null
    start_date: string | null
    end_date: string | null
    notes: string | null
    created_at: string
  }>
  const immunizationRows = (immunizationResult.data ?? []) as Array<{
    id: string
    vaccine_name: string
    administered_date: string | null
    dose_number: number | null
    lot_number: string | null
    notes: string | null
    created_at: string
  }>
  const prescriptionRows = (prescriptionResult.data ?? []) as unknown as Array<{
    id: string
    dosage: string | null
    frequency: string | null
    duration_days: number | null
    quantity: number | null
    instructions: string | null
    status: string
    created_at: string
    medicines:
      | { generic_name: string; brand_name: string | null }
      | Array<{ generic_name: string; brand_name: string | null }>
      | null
  }>
  const today = new Date().toISOString().slice(0, 10)

  return {
    error: null,
    data: {
      medicalHistory: historyRows.map((row) => ({
        id: row.id,
        condition: row.condition_name,
        diagnosedDate: row.diagnosed_date,
        status: row.status,
        notes: row.notes,
        createdAt: row.created_at,
      })),
      allergies: allergyRows.map((row) => ({
        id: row.id,
        allergen: row.allergen,
        reaction: row.reaction,
        severity: row.severity,
        notes: row.notes,
        createdAt: row.created_at,
      })),
      currentMedications: medicationRows
        .filter(
          (row) =>
            (!row.start_date || row.start_date <= today) &&
            (!row.end_date || row.end_date >= today),
        )
        .map((row) => ({
          id: row.id,
          medicineName: row.medicine_name,
          dosage: row.dosage,
          frequency: row.frequency,
          startDate: row.start_date,
          endDate: row.end_date,
          notes: row.notes,
          createdAt: row.created_at,
        })),
      immunizations: immunizationRows.map((row) => ({
        id: row.id,
        vaccineName: row.vaccine_name,
        administeredDate: row.administered_date,
        doseNumber: row.dose_number,
        lotNumber: row.lot_number,
        notes: row.notes,
        createdAt: row.created_at,
      })),
      prescriptions: prescriptionRows.map((row) => {
        const medicine = Array.isArray(row.medicines)
          ? row.medicines[0]
          : row.medicines
        const medicineName = medicine?.brand_name
          ? `${medicine.generic_name} (${medicine.brand_name})`
          : medicine?.generic_name ?? "Medicine"
        return {
          id: row.id,
          medicineName,
          dosage: row.dosage,
          frequency: row.frequency,
          durationDays: row.duration_days,
          quantity: row.quantity,
          instructions: row.instructions,
          status: row.status,
          createdAt: row.created_at,
        }
      }),
      consultations: completedConsultations
        .map(({ consultation, checkedInAt, visitType }) => {
          const doctor = Array.isArray(consultation.doctor)
            ? consultation.doctor[0]
            : consultation.doctor
          const nurse = Array.isArray(consultation.nurse)
            ? consultation.nurse[0]
            : consultation.nurse
          const triage = Array.isArray(consultation.triage_assessments)
            ? consultation.triage_assessments[0]
            : consultation.triage_assessments
          return {
            id: consultation.id,
            visitType,
            checkedInAt,
            completedAt: consultation.completed_at,
            patientComplaint: consultation.patient_complaint,
            vitalsDisposition: consultation.vitals_disposition,
            vitalsSkipReason: consultation.vitals_skip_reason,
            nurseName: nurse?.display_name ?? null,
            doctorName: doctor?.display_name ?? null,
            nurseHandoffNote: consultation.nurse_handoff_note,
            nurseHandoffAt: consultation.nurse_handoff_at,
            doctorReviewNote: consultation.doctor_review_note,
            triage: triage
              ? {
                  temperature: triage.temperature,
                  bloodPressure: triage.blood_pressure,
                  heartRate: triage.heart_rate,
                  respiratoryRate: triage.respiratory_rate,
                  oxygenSaturation: triage.oxygen_saturation,
                  notes: triage.notes,
                }
              : null,
            diagnoses: (consultation.diagnoses ?? []).map((diagnosis) => ({
              description: diagnosis.description,
              code: diagnosis.icd10_code,
            })),
            treatments: (consultation.treatments ?? []).map((treatment) => ({
              plan: treatment.treatment_plan,
              instructions: treatment.instructions,
            })),
            prescriptions: (consultation.prescriptions ?? []).map(
              (prescription) => {
                const medicine = Array.isArray(prescription.medicines)
                  ? prescription.medicines[0]
                  : prescription.medicines
                return {
                  id: prescription.id,
                  medicineName: medicine?.brand_name
                    ? `${medicine.generic_name} (${medicine.brand_name})`
                    : medicine?.generic_name ?? "Medicine",
                  dosage: prescription.dosage,
                  frequency: prescription.frequency,
                  durationDays: prescription.duration_days,
                  quantity: prescription.quantity,
                  instructions: prescription.instructions,
                  status: prescription.status,
                  createdAt: prescription.created_at,
                }
              },
            ),
            followUps: (consultation.follow_ups ?? []).map((followUp) => ({
              scheduledDate: followUp.scheduled_date,
              reason: followUp.reason,
              status: followUp.status,
            })),
          }
        })
        .sort(
          (left, right) =>
            new Date(right.completedAt ?? right.checkedInAt).getTime() -
            new Date(left.completedAt ?? left.checkedInAt).getTime(),
        ),
    },
  }
}

// Loads exam, sick-leave, and document DTOs for one patient.
async function loadComplianceData(
  patientId: string,
  patientRole: PatientProfileRole,
): Promise<{
  error: string | null
  exams: MedicalExamDTO[]
  sickLeave: SickLeaveDTO[]
  documents: ComplianceDocumentDTO[]
}> {
  const admin = createAdminClient()
  const idColumn = `${patientRole}_id`
  const examPromise = admin
    .from("medical_exam_results")
    .select(
      "id,school_year,semester,calendar_year,clinical_result_status,exam_details,result_storage_path,result_file_name,result_mime_type,result_file_size,created_at",
    )
    .eq(idColumn, patientId)
    .order("created_at", { ascending: false })
  const sickPromise =
    patientRole === "student"
      ? Promise.resolve({ data: [], error: null })
      : admin
          .from("sick_leave_entries")
          .select(
            "id,start_date,end_date,reason_diagnosis,certificate_storage_path,certificate_file_name,certificate_mime_type,certificate_file_size,created_at",
          )
          .eq(idColumn, patientId)
          .order("start_date", { ascending: false })
  const [examResult, sickResult, documentResult] = await Promise.all([
    examPromise,
    sickPromise,
    loadAggregatedDocuments(patientId, patientRole),
  ])
  const error =
    examResult.error?.message ?? sickResult.error?.message ?? documentResult.error
  if (error) return { error, exams: [], sickLeave: [], documents: [] }

  const examRows = (examResult.data ?? []) as ExamRow[]
  const sickRows = (sickResult.data ?? []) as SickLeaveRow[]
  const examUrls = await signCompliancePaths(
    examRows.map((row) => row.result_storage_path),
  )
  const sickUrls = await signCompliancePaths(
    sickRows.map((row) => row.certificate_storage_path),
  )

  return {
    error: null,
    exams: examRows.map((row) => ({
      id: row.id,
      schoolYear: row.school_year,
      semester: row.semester,
      calendarYear: row.calendar_year,
      clinicalResultStatus: row.clinical_result_status,
      examDetails: row.exam_details,
      fileName: row.result_file_name,
      mimeType: row.result_mime_type,
      fileSize: row.result_file_size,
      createdAt: row.created_at,
      downloadUrl: examUrls.get(row.result_storage_path) ?? "",
    })),
    sickLeave: sickRows.map((row) => ({
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      reasonDiagnosis: row.reason_diagnosis,
      fileName: row.certificate_file_name,
      mimeType: row.certificate_mime_type,
      fileSize: row.certificate_file_size,
      createdAt: row.created_at,
      downloadUrl: sickUrls.get(row.certificate_storage_path) ?? "",
    })),
    documents: documentResult.documents,
  }
}

// Aggregates existing generic documents with compliance artifacts.
async function loadAggregatedDocuments(
  patientId: string,
  patientRole: PatientProfileRole,
): Promise<{ error: string | null; documents: ComplianceDocumentDTO[] }> {
  const admin = createAdminClient()
  const idColumn = `${patientRole}_id`
  const genericTable = `${patientRole}_documents`
  const genericBucket = `${patientRole}-documents`
  const [genericResult, examResult, sickResult] = await Promise.all([
    admin
      .from(genericTable)
      .select("id,document_type,file_url,file_name,mime_type,file_size,created_at")
      .eq(idColumn, patientId)
      .order("created_at", { ascending: false }),
    admin
      .from("medical_exam_results")
      .select(
        "id,result_storage_path,result_file_name,result_mime_type,result_file_size,created_at",
      )
      .eq(idColumn, patientId)
      .order("created_at", { ascending: false }),
    patientRole === "student"
      ? Promise.resolve({ data: [], error: null })
      : admin
          .from("sick_leave_entries")
          .select(
            "id,certificate_storage_path,certificate_file_name,certificate_mime_type,certificate_file_size,created_at",
          )
          .eq(idColumn, patientId)
          .order("created_at", { ascending: false }),
  ])
  const error =
    genericResult.error?.message ??
    examResult.error?.message ??
    sickResult.error?.message
  if (error) return { error, documents: [] }

  const genericRows = (genericResult.data ?? []) as GeneralDocumentRow[]
  const examRows = (examResult.data ?? []) as Array<{
    id: string
    result_storage_path: string
    result_file_name: string
    result_mime_type: string
    result_file_size: number
    created_at: string
  }>
  const sickRows = (sickResult.data ?? []) as Array<{
    id: string
    certificate_storage_path: string
    certificate_file_name: string
    certificate_mime_type: string
    certificate_file_size: number
    created_at: string
  }>
  const storedGenericPaths = genericRows
    .map((row) => row.file_url)
    .filter((path) => !/^https?:\/\//i.test(path))
  const [genericSigned, complianceSigned] = await Promise.all([
    storedGenericPaths.length
      ? admin.storage
          .from(genericBucket)
          .createSignedUrls(storedGenericPaths, SIGNED_URL_SECONDS)
      : Promise.resolve({ data: [], error: null }),
    signCompliancePaths([
      ...examRows.map((row) => row.result_storage_path),
      ...sickRows.map((row) => row.certificate_storage_path),
    ]),
  ])
  const genericUrls = new Map(
    (genericSigned.data ?? []).map((item) => [item.path, item.signedUrl ?? ""]),
  )
  const documents: ComplianceDocumentDTO[] = [
    ...genericRows.map((row) => ({
      id: `general:${row.id}`,
      category: "general" as const,
      label: row.document_type,
      fileName: row.file_name ?? "Document",
      mimeType: row.mime_type,
      fileSize: row.file_size,
      createdAt: row.created_at,
      downloadUrl: /^https?:\/\//i.test(row.file_url)
        ? row.file_url
        : genericUrls.get(row.file_url) ?? "",
    })),
    ...examRows.map((row) => ({
      id: `annual_exam:${row.id}`,
      category: "annual_exam" as const,
      label: "Annual Medical Exam",
      fileName: row.result_file_name,
      mimeType: row.result_mime_type,
      fileSize: row.result_file_size,
      createdAt: row.created_at,
      downloadUrl: complianceSigned.get(row.result_storage_path) ?? "",
    })),
    ...sickRows.map((row) => ({
      id: `sick_leave:${row.id}`,
      category: "sick_leave" as const,
      label: "Sick Leave Certificate",
      fileName: row.certificate_file_name,
      mimeType: row.certificate_mime_type,
      fileSize: row.certificate_file_size,
      createdAt: row.created_at,
      downloadUrl: complianceSigned.get(row.certificate_storage_path) ?? "",
    })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return { error: null, documents }
}

// Creates five-minute signed URLs without returning stored object paths.
async function signCompliancePaths(paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map()
  const { data } = await createAdminClient().storage
    .from(COMPLIANCE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS)
  return new Map(
    (data ?? [])
      .filter((item): item is typeof item & { path: string } => Boolean(item.path))
      .map((item) => [item.path, item.signedUrl ?? ""]),
  )
}

// Derives the current Employee compliance badge from annual exam presence.
function getEmployeeComplianceStatus(
  exams: MedicalExamDTO[],
): EmployeeComplianceStatus {
  const now = new Date()
  const year = now.getFullYear()
  if (exams.some((exam) => exam.calendarYear === year)) return "completed"

  const yearEnd = new Date(year, 11, 31)
  const remainingDays = Math.ceil(
    (yearEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1_000),
  )
  return remainingDays <= 60 ? "due_soon" : "overdue"
}

// Maps one patient role to exactly one database foreign-key column.
function getPatientColumns(
  patientId: string,
  patientRole: PatientProfileRole,
) {
  return {
    patient_role: patientRole,
    student_id: patientRole === "student" ? patientId : null,
    faculty_id: patientRole === "faculty" ? patientId : null,
    staff_id: patientRole === "staff" ? patientId : null,
  }
}

// Validates the role-specific Annual Medical Exam fields.
function validateExamRoleFields(data: z.infer<typeof examSchema>): string | null {
  if (data.patientRole === "student") {
    return data.schoolYear && data.semester && data.clinicalResultStatus
      ? null
      : "School year, semester, and clinical result are required for students"
  }
  return data.calendarYear
    ? null
    : "Calendar year is required for Faculty and Staff"
}

// Validates compliance upload type and the project-wide 10 MB limit.
function validateComplianceFile(value: FormDataEntryValue | null): string | null {
  if (!(value instanceof File) || value.size === 0) {
    return "A PDF, JPEG, or PNG file is required"
  }
  if (!(value.type in MIME_EXTENSION)) {
    return "Upload a PDF, JPEG, or PNG file"
  }
  if (value.size > MAX_FILE_SIZE_BYTES) return "Files must be 10 MB or smaller"
  return null
}

// Builds an opaque private Storage path from trusted MIME metadata.
function buildStoragePath(
  patientRole: PatientProfileRole,
  patientId: string,
  category: "annual-exams" | "sick-leave",
  mimeType: string,
): string {
  return `${patientRole}/${patientId}/${category}/${crypto.randomUUID()}.${MIME_EXTENSION[mimeType]}`
}

// Normalizes optional FormData values before Zod parsing.
function optionalFormValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim()
  return normalized || undefined
}

// Returns the first user-safe Zod validation message.
function firstValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid form data"
}

// Records a minimal audit event without document paths or diagnoses.
async function recordComplianceAudit(
  actor: ActionActor,
  patientId: string,
  recordType: "annual_exam" | "sick_leave" | "general_document",
) {
  await logAuditEvent({
    action: "MEDICAL_RECORD_MODIFY",
    userId: actor.id,
    email: actor.email,
    resource: patientId,
    details: { record_type: recordType },
  })
}

// Invalidates all record surfaces after a compliance write.
function revalidateRecordRoutes() {
  for (const path of [
    "/admin/records/view",
    "/admin/staffhealth/record",
    "/doctor/records/view",
    "/doctor/staffhealth/record",
    "/nurse/records/view",
    "/nurse/staffhealth/record",
    "/student/records/my_record",
    "/faculty/staffhealth/my_record",
    "/staff/staffhealth/my_record",
  ]) {
    revalidatePath(path)
  }
}
