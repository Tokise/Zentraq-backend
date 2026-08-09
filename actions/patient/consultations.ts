"use server"

import { z } from "zod"

import { getActionActor } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

export type MyConsultationTab =
  | "overview"
  | "history"
  | "prescriptions"
  | "diagnoses"
  | "vitals"
  | "follow-ups"

export type MyConsultationRow = {
  id: string
  consultationId: string
  kind:
    | "history"
    | "prescription"
    | "diagnosis"
    | "treatment"
    | "vitals"
    | "follow-up"
  date: string
  title: string
  summary: string | null
  status: string | null
  clinicianName: string
  clinicianRole: "admin" | "doctor" | "nurse" | null
  details: Array<{ label: string; value: string }>
}

export type MyConsultationOverview = {
  consultations: number
  prescriptions: number
  diagnosesAndTreatments: number
  vitals: number
  followUps: number
}

const PAGE_SIZE = 10
const requestSchema = z.object({
  tab: z.enum([
    "overview",
    "history",
    "prescriptions",
    "diagnoses",
    "vitals",
    "follow-ups",
  ]),
  page: z.number().int().min(1).max(10_000).default(1),
})

type PatientIdentity = {
  id: string
  role: "student" | "faculty" | "staff"
}

type CompletedConsultation = {
  id: string
  chief_complaint: string | null
  consultation_notes: string | null
  completed_at: string | null
  created_at: string
  doctor_id: string | null
  nurse_id: string | null
  completed_by_clinic_account_id: string | null
}

type ClinicianLabel = {
  name: string
  role: "admin" | "doctor" | "nurse"
}

// Returns one authorized page from the signed-in user's completed consultations.
export async function getMyConsultationWorkspaceAction(
  input: unknown,
): Promise<{
  error: string | null
  rows: MyConsultationRow[]
  overview: MyConsultationOverview
  page: number
  pageSize: number
  total: number
  totalPages: number
  patientTopic: string | null
}> {
  const parsed = requestSchema.safeParse(input)
  const identity = await resolveOwnPatientIdentity()
  if (!parsed.success || !identity) {
    return emptyResult(
      parsed.success ? parsed.data.page : 1,
      "Patient profile not found",
    )
  }

  const admin = createAdminClient()
  const idColumn = `${identity.role}_id`
  const { data: visits, error: visitError } = await admin
    .from("clinic_visits")
    .select("id")
    .eq(idColumn, identity.id)
  if (visitError) return emptyResult(parsed.data.page, visitError.message)
  const visitIds = (visits ?? []).map((visit) => visit.id)
  if (!visitIds.length) {
    return {
      ...emptyResult(parsed.data.page, null),
      patientTopic: `patient-record:${identity.role}:${identity.id}`,
    }
  }

  const { data: consultationData, error: consultationError } = await admin
    .from("consultations")
    .select(
      "id,chief_complaint,consultation_notes,completed_at,created_at,doctor_id,nurse_id,completed_by_clinic_account_id",
    )
    .in("visit_id", visitIds)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
  if (consultationError) {
    return emptyResult(parsed.data.page, consultationError.message)
  }

  const consultations = (consultationData ?? []) as CompletedConsultation[]
  const consultationIds = consultations.map((consultation) => consultation.id)
  const [clinicians, overview] = await Promise.all([
    loadClinicianLabels(consultations),
    loadOverviewCounts(consultationIds, consultations.length),
  ])
  const pageResult = await loadTabPage(
    parsed.data.tab,
    parsed.data.page,
    consultations,
    clinicians,
  )
  return {
    error: pageResult.error,
    rows: pageResult.rows,
    overview,
    page: parsed.data.page,
    pageSize: PAGE_SIZE,
    total: pageResult.total,
    totalPages: Math.ceil(pageResult.total / PAGE_SIZE),
    patientTopic: `patient-record:${identity.role}:${identity.id}`,
  }
}

// Resolves a patient profile by user_id independently of the portal login role.
async function resolveOwnPatientIdentity(): Promise<PatientIdentity | null> {
  const actor = await getActionActor()
  if (!actor) return null
  const admin = createAdminClient()
  const [student, faculty, staff] = await Promise.all([
    admin.from("students").select("id").eq("user_id", actor.id).maybeSingle(),
    admin.from("faculty").select("id").eq("user_id", actor.id).maybeSingle(),
    admin.from("staff").select("id").eq("user_id", actor.id).maybeSingle(),
  ])
  if (student.data) return { id: student.data.id, role: "student" }
  if (faculty.data) return { id: faculty.data.id, role: "faculty" }
  if (staff.data) return { id: staff.data.id, role: "staff" }
  return null
}

// Maps consultation clinic-account references to safe display labels.
async function loadClinicianLabels(
  consultations: CompletedConsultation[],
): Promise<Map<string, ClinicianLabel>> {
  const accountIds = [
    ...new Set(
      consultations.flatMap((consultation) => {
        const id =
          consultation.completed_by_clinic_account_id ??
          consultation.doctor_id ??
          consultation.nurse_id
        return id ? [id] : []
      }),
    ),
  ]
  if (!accountIds.length) return new Map()
  const { data } = await createAdminClient()
    .from("clinic_accounts")
    .select("id,display_name,role")
    .in("id", accountIds)
  return new Map(
    (data ?? []).map((account) => [
      account.id,
      {
        name: account.display_name,
        role: account.role as ClinicianLabel["role"],
      },
    ]),
  )
}

// Counts the completed consultation sections used by the Overview tab.
async function loadOverviewCounts(
  consultationIds: string[],
  consultationCount: number,
): Promise<MyConsultationOverview> {
  if (!consultationIds.length) {
    return {
      consultations: 0,
      prescriptions: 0,
      diagnosesAndTreatments: 0,
      vitals: 0,
      followUps: 0,
    }
  }
  const admin = createAdminClient()
  const [prescriptions, diagnoses, treatments, vitals, followUps] =
    await Promise.all([
      admin
        .from("prescriptions")
        .select("id", { count: "exact", head: true })
        .in("consultation_id", consultationIds),
      admin
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .in("consultation_id", consultationIds),
      admin
        .from("treatments")
        .select("id", { count: "exact", head: true })
        .in("consultation_id", consultationIds),
      admin
        .from("triage_assessments")
        .select("id", { count: "exact", head: true })
        .in("consultation_id", consultationIds),
      admin
        .from("follow_ups")
        .select("id", { count: "exact", head: true })
        .in("consultation_id", consultationIds),
    ])
  return {
    consultations: consultationCount,
    prescriptions: prescriptions.count ?? 0,
    diagnosesAndTreatments:
      (diagnoses.count ?? 0) + (treatments.count ?? 0),
    vitals: vitals.count ?? 0,
    followUps: followUps.count ?? 0,
  }
}

// Loads and minimizes the requested tab while keeping database paging deterministic.
async function loadTabPage(
  tab: MyConsultationTab,
  page: number,
  consultations: CompletedConsultation[],
  clinicians: Map<string, ClinicianLabel>,
): Promise<{ error: string | null; rows: MyConsultationRow[]; total: number }> {
  if (tab === "overview") return { error: null, rows: [], total: 0 }
  const start = (page - 1) * PAGE_SIZE
  const consultationIds = consultations.map((consultation) => consultation.id)
  const consultationMap = new Map(
    consultations.map((consultation) => [consultation.id, consultation]),
  )

  if (tab === "history") {
    const rows = consultations
      .slice(start, start + PAGE_SIZE)
      .map((consultation) =>
        historyRow(consultation, clinicianFor(consultation, clinicians)),
      )
    return { error: null, rows, total: consultations.length }
  }

  const table =
    tab === "prescriptions"
      ? "prescriptions"
      : tab === "vitals"
        ? "triage_assessments"
        : tab === "follow-ups"
          ? "follow_ups"
          : null
  if (table) {
    return loadSingleTablePage(
      table,
      tab as "prescriptions" | "vitals" | "follow-ups",
      consultationIds,
      consultationMap,
      clinicians,
      start,
    )
  }
  return loadDiagnosisTreatmentPage(
    consultationIds,
    consultationMap,
    clinicians,
    start,
  )
}

// Loads one database-backed tab from a single consultation child table.
async function loadSingleTablePage(
  table: "prescriptions" | "triage_assessments" | "follow_ups",
  tab: "prescriptions" | "vitals" | "follow-ups",
  consultationIds: string[],
  consultationMap: Map<string, CompletedConsultation>,
  clinicians: Map<string, ClinicianLabel>,
  start: number,
) {
  if (!consultationIds.length) return { error: null, rows: [], total: 0 }
  const select =
    tab === "prescriptions"
      ? "id,consultation_id,dosage,frequency,duration_days,quantity,instructions,status,created_at,medicines(generic_name,brand_name)"
      : tab === "vitals"
        ? "id,consultation_id,temperature,blood_pressure,heart_rate,respiratory_rate,oxygen_saturation,weight,height,created_at"
        : "id,consultation_id,scheduled_date,reason,status,completed_at,created_at"
  const { data, count, error } = await createAdminClient()
    .from(table)
    .select(select, { count: "exact" })
    .in("consultation_id", consultationIds)
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1)
  if (error) return { error: error.message, rows: [], total: 0 }
  const typedRows = (data ?? []) as unknown as Array<Record<string, unknown>>
  const rows = typedRows.map((row) => {
    const consultation = consultationMap.get(String(row.consultation_id))
    const clinician = consultation
      ? clinicianFor(consultation, clinicians)
      : null
    return childRow(tab, row, consultation, clinician)
  })
  return { error: null, rows, total: count ?? 0 }
}

// Combines diagnosis and treatment rows before applying their shared page.
async function loadDiagnosisTreatmentPage(
  consultationIds: string[],
  consultationMap: Map<string, CompletedConsultation>,
  clinicians: Map<string, ClinicianLabel>,
  start: number,
) {
  if (!consultationIds.length) return { error: null, rows: [], total: 0 }
  const admin = createAdminClient()
  const [diagnoses, treatments] = await Promise.all([
    admin
      .from("diagnoses")
      .select("id,consultation_id,icd10_code,description,is_primary,created_at")
      .in("consultation_id", consultationIds)
      .order("created_at", { ascending: false }),
    admin
      .from("treatments")
      .select(
        "id,consultation_id,treatment_plan,instructions,follow_up_days,created_at",
      )
      .in("consultation_id", consultationIds)
      .order("created_at", { ascending: false }),
  ])
  const error = diagnoses.error?.message ?? treatments.error?.message
  if (error) return { error, rows: [], total: 0 }
  const combined = [
    ...(diagnoses.data ?? []).map((row) => ({ ...row, kind: "diagnosis" as const })),
    ...(treatments.data ?? []).map((row) => ({ ...row, kind: "treatment" as const })),
  ].sort((left, right) => right.created_at.localeCompare(left.created_at))
  const rows = combined.slice(start, start + PAGE_SIZE).map((row) => {
    const consultation = consultationMap.get(row.consultation_id)
    const clinician = consultation
      ? clinicianFor(consultation, clinicians)
      : null
    if (row.kind === "diagnosis") {
      return makeRow({
        id: row.id,
        consultation,
        clinician,
        kind: "diagnosis",
        date: row.created_at,
        title: row.description ?? "Diagnosis",
        summary: row.icd10_code,
        status: row.is_primary ? "primary" : "secondary",
        details: [detail("ICD-10", row.icd10_code)],
      })
    }
    return makeRow({
      id: row.id,
      consultation,
      clinician,
      kind: "treatment",
      date: row.created_at,
      title: row.treatment_plan ?? "Treatment",
      summary: row.instructions,
      status: null,
      details: [
        detail("Instructions", row.instructions),
        detail(
          "Follow-up",
          row.follow_up_days ? `${row.follow_up_days} days` : null,
        ),
      ],
    })
  })
  return { error: null, rows, total: combined.length }
}

// Converts a completed consultation into a safe patient-facing history row.
function historyRow(
  consultation: CompletedConsultation,
  clinician: ClinicianLabel | null,
): MyConsultationRow {
  return makeRow({
    id: consultation.id,
    consultation,
    clinician,
    kind: "history",
    date: consultation.completed_at ?? consultation.created_at,
    title: consultation.chief_complaint ?? "Consultation",
    summary: consultation.consultation_notes,
    status: "completed",
    details: [detail("Outcome", consultation.consultation_notes)],
  })
}

// Converts one clinical child row into the common patient-facing table shape.
function childRow(
  tab: "prescriptions" | "vitals" | "follow-ups",
  row: Record<string, unknown>,
  consultation: CompletedConsultation | undefined,
  clinician: ClinicianLabel | null,
): MyConsultationRow {
  if (tab === "prescriptions") {
    const medicineRelation = row.medicines
    const medicine = Array.isArray(medicineRelation)
      ? medicineRelation[0]
      : medicineRelation
    const typedMedicine = medicine as
      | { generic_name?: string; brand_name?: string | null }
      | null
      | undefined
    const medicineName = typedMedicine?.brand_name
      ? `${typedMedicine.generic_name} (${typedMedicine.brand_name})`
      : typedMedicine?.generic_name ?? "Medicine"
    return makeRow({
      id: String(row.id),
      consultation,
      clinician,
      kind: "prescription",
      date: String(row.created_at),
      title: medicineName,
      summary: join([row.dosage, row.frequency]),
      status: typeof row.status === "string" ? row.status : null,
      details: [
        detail("Duration", row.duration_days ? `${row.duration_days} days` : null),
        detail("Quantity", row.quantity ? String(row.quantity) : null),
        detail("Instructions", row.instructions),
      ],
    })
  }
  if (tab === "vitals") {
    return makeRow({
      id: String(row.id),
      consultation,
      clinician,
      kind: "vitals",
      date: String(row.created_at),
      title: "Vital signs",
      summary: join([
        row.temperature ? `${row.temperature} °C` : null,
        row.blood_pressure ? `BP ${row.blood_pressure}` : null,
        row.heart_rate ? `${row.heart_rate} bpm` : null,
      ]),
      status: null,
      details: [
        detail("Respiratory rate", row.respiratory_rate),
        detail("Oxygen saturation", row.oxygen_saturation),
        detail("Weight", row.weight),
        detail("Height", row.height),
      ],
    })
  }
  return makeRow({
    id: String(row.id),
    consultation,
    clinician,
    kind: "follow-up",
    date: String(row.scheduled_date ?? row.created_at),
    title: "Follow-up",
    summary: typeof row.reason === "string" ? row.reason : null,
    status: typeof row.status === "string" ? row.status : null,
    details: [detail("Completed", row.completed_at)],
  })
}

// Creates the common row without leaking clinic-account identifiers.
function makeRow(input: {
  id: string
  consultation: CompletedConsultation | undefined
  clinician: ClinicianLabel | null
  kind: MyConsultationRow["kind"]
  date: string
  title: string
  summary: string | null
  status: string | null
  details: Array<{ label: string; value: string } | null>
}): MyConsultationRow {
  return {
    id: input.id,
    consultationId: input.consultation?.id ?? "",
    kind: input.kind,
    date: input.date,
    title: input.title,
    summary: input.summary,
    status: input.status,
    clinicianName: input.clinician?.name ?? "Clinic team",
    clinicianRole: input.clinician?.role ?? null,
    details: input.details.filter(
      (item): item is { label: string; value: string } => item !== null,
    ),
  }
}

// Resolves the completion clinician with legacy Doctor or Nurse fallback.
function clinicianFor(
  consultation: CompletedConsultation,
  clinicians: Map<string, ClinicianLabel>,
): ClinicianLabel | null {
  const accountId =
    consultation.completed_by_clinic_account_id ??
    consultation.doctor_id ??
    consultation.nurse_id
  return accountId ? clinicians.get(accountId) ?? null : null
}

// Creates one optional display detail without passing raw null values to clients.
function detail(
  label: string,
  value: unknown,
): { label: string; value: string } | null {
  if (value === null || value === undefined || value === "") return null
  return { label, value: String(value) }
}

// Joins optional compact values into one readable summary.
function join(values: unknown[]): string | null {
  const present = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(String)
  return present.length ? present.join(" · ") : null
}

// Returns the stable empty workspace contract for an error or no data.
function emptyResult(page: number, error: string | null) {
  return {
    error,
    rows: [] as MyConsultationRow[],
    overview: {
      consultations: 0,
      prescriptions: 0,
      diagnosesAndTreatments: 0,
      vitals: 0,
      followUps: 0,
    },
    page,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    patientTopic: null as string | null,
  }
}
