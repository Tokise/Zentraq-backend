"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  Pill,
  Plus,
  Stethoscope,
  Syringe,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  addClinicalSectionAction,
  getComplianceDocumentUrlAction,
  uploadGeneralDocumentAction,
  uploadMedicalExamAction,
  uploadSickLeaveAction,
  type ComplianceDocumentDTO,
  type ComplianceRecordDTO,
  type MedicalExamDTO,
  type PatientProfileRole,
  type SickLeaveDTO,
} from "@/actions/clinical/records/compliance"
import { AttachmentCarousel } from "@/components/medical/attachment-carousel"
import { StaffRecordExtras } from "@/components/medical/staff-record-extras"
import { SensitiveField } from "@/components/common/sensitive-field"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTablePagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export type HealthRecordTab = "profile" | "exam" | "sick-leave" | "documents"

interface HealthRecordTabsProps {
  role: PatientProfileRole
  record: ComplianceRecordDTO
  readOnly: boolean
  capabilities: {
    canAddExam: boolean
    canAddDocument?: boolean
    canAddSickLeave: boolean
    canAddHistory?: boolean
    canAddMedication?: boolean
    canAddAllergy?: boolean
    canAddImmunization?: boolean
  }
  activeTab?: HealthRecordTab
  onTabChange?: (tab: HealthRecordTab) => void
  onChanged?: () => Promise<void> | void
  showPreviousConsultations?: boolean
}

const PAGE_SIZE = 10

// Renders the shared Student, Faculty, and Staff compliance record tabs.
export function HealthRecordTabs({
  role,
  record,
  readOnly,
  capabilities,
  activeTab,
  onTabChange,
  onChanged,
  showPreviousConsultations = false,
}: HealthRecordTabsProps) {
  const [internalTab, setInternalTab] = useState<HealthRecordTab>("profile")
  const [examPage, setExamPage] = useState(1)
  const [leavePage, setLeavePage] = useState(1)
  const [documentPage, setDocumentPage] = useState(1)
  const selectedTab = activeTab ?? internalTab
  const recordVersion = [
    record.profile.id,
    record.exams.length,
    record.sickLeave.length,
    record.documents.length,
    record.clinical.medicalHistory.length,
    record.clinical.allergies.length,
    record.clinical.currentMedications.length,
    record.clinical.immunizations.length,
    record.clinical.prescriptions.length,
  ].join(":")

  useEffect(() => {
    const resetPages = window.setTimeout(() => {
      setExamPage(1)
      setLeavePage(1)
      setDocumentPage(1)
    }, 0)
    return () => window.clearTimeout(resetPages)
  }, [recordVersion])

  // Changes tabs and resets that tab's local page.
  function changeTab(value: string) {
    const next = value as HealthRecordTab
    setInternalTab(next)
    if (next === "exam") setExamPage(1)
    if (next === "sick-leave") setLeavePage(1)
    if (next === "documents") setDocumentPage(1)
    onTabChange?.(next)
  }

  return (
    <Tabs className="space-y-5" onValueChange={changeTab} value={selectedTab}>
      <TabsList className="max-w-full flex-wrap justify-start">
        <TabsTrigger value="profile">Profile Overview</TabsTrigger>
        <TabsTrigger value="exam">Annual Medical Exam</TabsTrigger>
        {role !== "student" && (
          <TabsTrigger value="sick-leave">Sick Leave Log</TabsTrigger>
        )}
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <div className="space-y-5">
          <ProfileOverview
            capabilities={capabilities}
            onChanged={onChanged}
            readOnly={readOnly}
            record={record}
          />
          {showPreviousConsultations && (
            <StaffRecordExtras
              patientId={record.profile.id}
              patientType={record.profile.role}
            />
          )}
        </div>
      </TabsContent>

      <TabsContent value="exam">
        <AnnualExamPanel
          canAdd={!readOnly && capabilities.canAddExam}
          exams={record.exams}
          onChanged={onChanged}
          page={examPage}
          patientId={record.profile.id}
          role={role}
          setPage={setExamPage}
          status={record.employeeStatus}
        />
      </TabsContent>

      {role !== "student" && (
        <TabsContent value="sick-leave">
          <SickLeavePanel
            canAdd={!readOnly && capabilities.canAddSickLeave}
            entries={record.sickLeave}
            onChanged={onChanged}
            page={leavePage}
            patientId={record.profile.id}
            role={role}
            setPage={setLeavePage}
          />
        </TabsContent>
      )}

      <TabsContent value="documents">
        <DocumentsPanel
          canAdd={!readOnly && Boolean(capabilities.canAddDocument)}
          documents={record.documents}
          onChanged={onChanged}
          page={documentPage}
          patientId={record.profile.id}
          role={role}
          setPage={setDocumentPage}
        />
      </TabsContent>
    </Tabs>
  )
}

// Renders the minimized patient profile DTO without RFID or account-role data.
function ProfileOverview({
  record,
  readOnly,
  capabilities,
  onChanged,
}: {
  record: ComplianceRecordDTO
  readOnly: boolean
  capabilities: HealthRecordTabsProps["capabilities"]
  onChanged?: () => Promise<void> | void
}) {
  const { profile } = record
  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`

  return (
    <div className="space-y-5">
      <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-16" size="lg">
            {profile.profilePhotoUrl && (
              <AvatarImage alt="Patient profile" src={profile.profilePhotoUrl} />
            )}
            <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl">
              <SensitiveField
                value={`${profile.firstName} ${profile.middleName ? `${profile.middleName} ` : ""}${profile.lastName}`}
              />
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap gap-2">
              <Badge className="capitalize" variant="outline">
                {profile.role}
              </Badge>
              <Badge variant="secondary">{profile.status}</Badge>
              {record.employeeStatus && (
                <ComplianceStatusBadge status={record.employeeStatus} />
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ProfileField label="ID number" value={profile.identifier} />
        <ProfileField label="Department" value={profile.department} />
        {profile.position && (
          <ProfileField label="Position" value={profile.position} />
        )}
        {profile.course && <ProfileField label="Course" value={profile.course} />}
        {profile.yearLevel && (
          <ProfileField label="Year level" value={String(profile.yearLevel)} />
        )}
        <ProfileField label="Email" value={profile.email} />
        <ProfileField label="Phone" value={profile.phone} />
        <ProfileField label="Address" value={profile.address} />
        {profile.birthDate && (
          <ProfileField label="Birth date" value={formatDate(profile.birthDate)} />
        )}
        {profile.gender && <ProfileField label="Gender" value={profile.gender} />}
        {profile.bloodType && (
          <ProfileField label="Blood type" value={profile.bloodType} />
        )}
      </CardContent>
      </Card>
      <ClinicalOverview
        capabilities={capabilities}
        onChanged={onChanged}
        readOnly={readOnly}
        record={record}
      />
    </div>
  )
}

// Renders one masked patient profile field.
function ProfileField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">
        {value ? <SensitiveField value={value} /> : "Not recorded"}
      </p>
    </div>
  )
}

// Renders the five shared clinical sections from the minimized record DTO.
function ClinicalOverview({
  record,
  readOnly,
  capabilities,
  onChanged,
}: {
  record: ComplianceRecordDTO
  readOnly: boolean
  capabilities: HealthRecordTabsProps["capabilities"]
  onChanged?: () => Promise<void> | void
}) {
  const clinical = record.clinical
  const [addSection, setAddSection] = useState<
    "history" | "allergy" | "medication" | "immunization" | null
  >(null)
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
      <ClinicalSectionCard
        className="lg:col-span-2"
        emptyLabel="No completed consultations recorded."
        icon={<Stethoscope className="size-4" />}
        title="Consultation Timeline"
      >
        {clinical.consultations.map((item) => (
          <ClinicalListItem
            badge="completed"
            details={[
              {
                label: "Visit",
                value: `${item.visitType.replaceAll("-", " ")} · ${formatDateTime(item.checkedInAt)}`,
              },
              {
                label: "Nurse handoff",
                value: item.nurseHandoffNote
                  ? `${item.nurseName ?? "Nurse"}: ${item.nurseHandoffNote}`
                  : null,
              },
              {
                label: "Vital signs and triage",
                value: formatConsultationVitals(item),
              },
              {
                label: "Doctor review",
                value: item.doctorReviewNote
                  ? `${item.doctorName ?? "Doctor"}: ${item.doctorReviewNote}`
                  : null,
              },
              {
                label: "Diagnosis",
                value: item.diagnoses.length
                  ? item.diagnoses
                      .map((diagnosis) =>
                        [diagnosis.code, diagnosis.description]
                          .filter(Boolean)
                          .join(" — "),
                      )
                      .join("; ")
                  : null,
              },
              {
                label: "Treatment",
                value: item.treatments.length
                  ? item.treatments
                      .flatMap((treatment) => [
                        treatment.plan,
                        treatment.instructions,
                      ])
                      .filter(Boolean)
                      .join(" · ")
                  : null,
              },
              {
                label: "Prescriptions",
                value: item.prescriptions.length
                  ? item.prescriptions
                      .map((prescription) =>
                        [
                          prescription.medicineName,
                          prescription.dosage,
                          prescription.frequency,
                          prescription.durationDays
                            ? `${prescription.durationDays} days`
                            : null,
                          prescription.status,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      )
                      .join("; ")
                  : null,
              },
              {
                label: "Follow-up",
                value: item.followUps.length
                  ? item.followUps
                      .map((followUp) =>
                        [
                          formatDate(followUp.scheduledDate),
                          followUp.reason,
                          followUp.status,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      )
                      .join("; ")
                  : null,
              },
            ]}
            key={item.id}
            title={item.patientComplaint ?? "Consultation"}
            titleLabel="Visit reason"
          />
        ))}
      </ClinicalSectionCard>
      <ClinicalSectionCard
        emptyLabel="No medical history recorded."
        icon={<ClipboardList className="size-4" />}
        onAdd={
          !readOnly && capabilities.canAddHistory
            ? () => setAddSection("history")
            : undefined
        }
        title="Medical History"
      >
        {clinical.medicalHistory.map((item) => (
          <ClinicalListItem
            badge={item.status}
            details={[
              {
                label: "Diagnosed",
                value: item.diagnosedDate
                  ? formatDate(item.diagnosedDate)
                  : null,
              },
              { label: "Notes", value: item.notes },
            ]}
            key={item.id}
            title={item.condition}
            titleLabel="Condition"
          />
        ))}
      </ClinicalSectionCard>

      <ClinicalSectionCard
        emptyLabel="No allergies recorded."
        icon={<AlertTriangle className="size-4" />}
        onAdd={
          !readOnly && capabilities.canAddAllergy
            ? () => setAddSection("allergy")
            : undefined
        }
        title="Allergies"
      >
        {clinical.allergies.map((item) => (
          <ClinicalListItem
            badge={item.severity}
            details={[
              { label: "Reaction", value: item.reaction },
              { label: "Notes", value: item.notes },
            ]}
            key={item.id}
            title={item.allergen}
            titleLabel="Allergen"
          />
        ))}
      </ClinicalSectionCard>

      <ClinicalSectionCard
        emptyLabel="No current medications recorded."
        icon={<Pill className="size-4" />}
        onAdd={
          !readOnly && capabilities.canAddMedication
            ? () => setAddSection("medication")
            : undefined
        }
        title="Current Medications"
      >
        {clinical.currentMedications.map((item) => (
          <ClinicalListItem
            details={[
              { label: "Dosage", value: item.dosage },
              { label: "Frequency", value: item.frequency },
              {
                label: "Started",
                value: item.startDate ? formatDate(item.startDate) : null,
              },
              {
                label: "Ends",
                value: item.endDate ? formatDate(item.endDate) : null,
              },
              { label: "Notes", value: item.notes },
            ]}
            key={item.id}
            title={item.medicineName}
            titleLabel="Medication"
          />
        ))}
      </ClinicalSectionCard>

      <ClinicalSectionCard
        emptyLabel="No immunizations recorded."
        icon={<Syringe className="size-4" />}
        onAdd={
          !readOnly && capabilities.canAddImmunization
            ? () => setAddSection("immunization")
            : undefined
        }
        title="Immunizations"
      >
        {clinical.immunizations.map((item) => (
          <ClinicalListItem
            details={[
              {
                label: "Administered",
                value: item.administeredDate
                  ? formatDate(item.administeredDate)
                  : null,
              },
              {
                label: "Dose",
                value: item.doseNumber ? String(item.doseNumber) : null,
              },
              { label: "Lot", value: item.lotNumber },
              { label: "Notes", value: item.notes },
            ]}
            key={item.id}
            title={item.vaccineName}
            titleLabel="Vaccine"
          />
        ))}
      </ClinicalSectionCard>

      <ClinicalSectionCard
        className="lg:col-span-2"
        emptyLabel="No completed-consultation prescriptions recorded."
        icon={<FileText className="size-4" />}
        title="Prescriptions"
      >
        {clinical.prescriptions.map((item) => (
          <ClinicalListItem
            badge={item.status}
            details={[
              { label: "Dosage", value: item.dosage },
              { label: "Frequency", value: item.frequency },
              {
                label: "Duration",
                value: item.durationDays
                  ? `${item.durationDays} days`
                  : null,
              },
              {
                label: "Quantity",
                value: item.quantity ? String(item.quantity) : null,
              },
              { label: "Instructions", value: item.instructions },
            ]}
            key={item.id}
            title={item.medicineName}
            titleLabel="Medication"
          />
        ))}
      </ClinicalSectionCard>
      </div>
      <ClinicalEntryDialog
        onChanged={onChanged}
        onOpenChange={(open) => !open && setAddSection(null)}
        patientId={record.profile.id}
        role={record.profile.role}
        section={addSection}
      />
    </>
  )
}

// Formats one consultation's recorded or explicitly skipped vital signs.
function formatConsultationVitals(
  consultation: ComplianceRecordDTO["clinical"]["consultations"][number],
): string | null {
  if (!consultation.triage) {
    return consultation.vitalsSkipReason
      ? `Not required — ${consultation.vitalsSkipReason}`
      : null
  }

  const values = [
    consultation.triage.temperature
      ? `${consultation.triage.temperature} °C`
      : null,
    consultation.triage.bloodPressure
      ? `BP ${consultation.triage.bloodPressure}`
      : null,
    consultation.triage.heartRate
      ? `HR ${consultation.triage.heartRate} bpm`
      : null,
    consultation.triage.respiratoryRate
      ? `RR ${consultation.triage.respiratoryRate}/min`
      : null,
    consultation.triage.oxygenSaturation
      ? `SpO₂ ${consultation.triage.oxygenSaturation}%`
      : null,
    consultation.triage.notes,
  ].filter((value): value is string => Boolean(value))

  return values.length ? values.join(" · ") : null
}

// Collects one validated role-aware clinical entry for the selected patient.
function ClinicalEntryDialog({
  section,
  patientId,
  role,
  onOpenChange,
  onChanged,
}: {
  section: "history" | "allergy" | "medication" | "immunization" | null
  patientId: string
  role: PatientProfileRole
  onOpenChange: (open: boolean) => void
  onChanged?: () => Promise<void> | void
}) {
  const [primary, setPrimary] = useState("")
  const [secondary, setSecondary] = useState("")
  const [tertiary, setTertiary] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("active")
  const [submitting, setSubmitting] = useState(false)

  // Clears medical-entry fields only after a successful authorized write.
  function resetForm() {
    setPrimary("")
    setSecondary("")
    setTertiary("")
    setStartDate("")
    setEndDate("")
    setNotes("")
    setStatus("active")
  }

  // Validates and persists the active clinical section through the shared action.
  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!section) return
    setSubmitting(true)
    const common = { patientId, patientRole: role, section }
    const input =
      section === "history"
        ? {
            ...common,
            section,
            conditionName: primary,
            diagnosedDate: startDate || undefined,
            status:
              status === "resolved" || status === "chronic"
                ? status
                : "active",
            notes: notes || undefined,
          }
        : section === "allergy"
          ? {
              ...common,
              section,
              allergen: primary,
              reaction: secondary || undefined,
              severity:
                status === "moderate" ||
                status === "severe" ||
                status === "critical"
                  ? status
                  : "mild",
              notes: notes || undefined,
            }
          : section === "medication"
            ? {
                ...common,
                section,
                medicineName: primary,
                dosage: secondary || undefined,
                frequency: tertiary || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                notes: notes || undefined,
              }
            : {
                ...common,
                section,
                vaccineName: primary,
                administeredDate: startDate || undefined,
                doseNumber: tertiary ? Number(tertiary) : undefined,
                lotNumber: secondary || undefined,
                notes: notes || undefined,
              }
    const result = await addClinicalSectionAction(input)
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`${sectionLabel(section)} added`)
    resetForm()
    onOpenChange(false)
    await onChanged?.()
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(section)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add {section ? sectionLabel(section) : "clinical entry"}
          </DialogTitle>
          <DialogDescription>
            This entry becomes part of the patient&apos;s protected health record.
          </DialogDescription>
        </DialogHeader>
        {section && (
          <form className="space-y-4" onSubmit={submitEntry}>
            <FormField label={primaryLabel(section)}>
              <Input
                onChange={(event) => setPrimary(event.target.value)}
                required
                value={primary}
              />
            </FormField>
            {(section === "allergy" ||
              section === "medication" ||
              section === "immunization") && (
              <FormField label={secondaryLabel(section)}>
                <Input
                  onChange={(event) => setSecondary(event.target.value)}
                  value={secondary}
                />
              </FormField>
            )}
            {(section === "history" || section === "allergy") && (
              <FormField label={
                section === "history" ? "Status" : "Severity"
              }>
                <Select onValueChange={(value) => setStatus(String(value))} value={status}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(section === "history"
                      ? ["active", "resolved", "chronic"]
                      : ["mild", "moderate", "severe", "critical"]
                    ).map((value) => (
                      <SelectItem key={value} value={value}>
                        <span className="capitalize">{value}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            {(section === "history" ||
              section === "medication" ||
              section === "immunization") && (
              <FormField label={dateLabel(section)}>
                <Input
                  onChange={(event) => setStartDate(event.target.value)}
                  type="date"
                  value={startDate}
                />
              </FormField>
            )}
            {section === "medication" && (
              <>
                <FormField label="Frequency">
                  <Input
                    onChange={(event) => setTertiary(event.target.value)}
                    value={tertiary}
                  />
                </FormField>
                <FormField label="End date">
                  <Input
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    type="date"
                    value={endDate}
                  />
                </FormField>
              </>
            )}
            {section === "immunization" && (
              <FormField label="Dose number">
                <Input
                  min={1}
                  onChange={(event) => setTertiary(event.target.value)}
                  type="number"
                  value={tertiary}
                />
              </FormField>
            )}
            <FormField label="Notes">
              <Textarea
                onChange={(event) => setNotes(event.target.value)}
                value={notes}
              />
            </FormField>
            <DialogFooter>
              <Button disabled={submitting} type="submit">
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Save entry
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Returns the patient-facing name for a clinical section.
function sectionLabel(
  section: "history" | "allergy" | "medication" | "immunization",
): string {
  if (section === "history") return "medical history"
  if (section === "allergy") return "allergy"
  if (section === "medication") return "current medication"
  return "immunization"
}

// Returns the required primary-field label for a clinical entry.
function primaryLabel(
  section: "history" | "allergy" | "medication" | "immunization",
): string {
  if (section === "history") return "Condition"
  if (section === "allergy") return "Allergen"
  if (section === "medication") return "Medicine"
  return "Vaccine"
}

// Returns the optional second-field label for a clinical entry.
function secondaryLabel(
  section: "allergy" | "medication" | "immunization",
): string {
  if (section === "allergy") return "Reaction"
  if (section === "medication") return "Dosage"
  return "Lot number"
}

// Returns the role-specific clinical date label.
function dateLabel(
  section: "history" | "medication" | "immunization",
): string {
  if (section === "history") return "Diagnosed date"
  if (section === "medication") return "Start date"
  return "Administered date"
}

// Provides a consistent accessible container for a clinical record section.
function ClinicalSectionCard({
  title,
  icon,
  emptyLabel,
  className,
  onAdd,
  children,
}: {
  title: string
  icon: React.ReactNode
  emptyLabel: string
  className?: string
  onAdd?: () => void
  children: React.ReactNode
}) {
  const hasItems = Array.isArray(children)
    ? children.length > 0
    : Boolean(children)
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {onAdd && (
          <Button onClick={onAdd} size="sm" type="button" variant="outline">
            <Plus className="size-4" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {hasItems ? (
          <div className="divide-y divide-border">{children}</div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  )
}

// Renders one masked clinical fact without exposing internal actor identifiers.
function ClinicalListItem({
  title,
  titleLabel,
  details,
  badge,
}: {
  title: string
  titleLabel: string
  details: Array<{
    label: string
    value: string | null | undefined
  }>
  badge?: string | null
}) {
  const visibleDetails = details.filter(
    (detail): detail is { label: string; value: string } =>
      Boolean(detail.value),
  )

  return (
    <article
      className={
        "grid gap-4 py-5 first:pt-0 last:pb-0 " +
        "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
      }
    >
      <div className="min-w-0 space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {titleLabel}
          </p>
          <SensitiveField
            ariaLabel={`${titleLabel.toLowerCase()} value`}
            className="w-full min-w-0 items-start"
            textClassName={
              "min-w-0 flex-1 break-words whitespace-normal font-sans " +
              "text-base font-semibold leading-6"
            }
            value={title}
          />
        </div>

        {visibleDetails.length > 0 && (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {visibleDetails.map((detail) => (
              <div className="min-w-0 space-y-1" key={detail.label}>
                <dt className="text-xs font-medium text-muted-foreground">
                  {detail.label}
                </dt>
                <dd className="text-sm leading-6 text-foreground">
                  <SensitiveField
                    ariaLabel={`${detail.label.toLowerCase()} value`}
                    className="w-full min-w-0 items-start"
                    textClassName="min-w-0 flex-1 break-words whitespace-normal font-sans leading-6"
                    value={detail.value}
                  />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {badge && (
        <Badge className="w-fit shrink-0 capitalize" variant="outline">
          {badge.replaceAll("_", " ")}
        </Badge>
      )}
    </article>
  )
}

// Renders annual exam history and the Admin-only upload dialog.
function AnnualExamPanel({
  canAdd,
  exams,
  onChanged,
  page,
  patientId,
  role,
  setPage,
  status,
}: {
  canAdd: boolean
  exams: MedicalExamDTO[]
  onChanged?: () => Promise<void> | void
  page: number
  patientId: string
  role: PatientProfileRole
  setPage: (page: number) => void
  status: ComplianceRecordDTO["employeeStatus"]
}) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ProtectedDocumentPreview | null>(null)
  const paged = usePagedRows(exams, page)

  // Changes exam pages and closes a preview from the previous page.
  function changeExamPage(nextPage: number) {
    setPreview(null)
    setPage(nextPage)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Annual Medical Exam</CardTitle>
            <CardDescription>
              Third-party medical exam results and compliance status.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {status && <ComplianceStatusBadge status={status} />}
            {canAdd && (
              <Button onClick={() => setOpen(true)} size="sm" type="button">
                <Plus className="size-4" />
                Add exam result
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              {role === "student" && <TableHead>Result</TableHead>}
              <TableHead>Details</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-28">File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.length ? (
              paged.rows.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">
                    {exam.schoolYear
                      ? `${exam.schoolYear} · ${exam.semester}`
                      : exam.calendarYear}
                  </TableCell>
                  {role === "student" && (
                    <TableCell>
                      <StudentResultBadge status={exam.clinicalResultStatus} />
                    </TableCell>
                  )}
                  <TableCell className="max-w-sm whitespace-normal">
                    {exam.examDetails}
                  </TableCell>
                  <TableCell>{formatDate(exam.createdAt)}</TableCell>
                  <TableCell>
                    <ProtectedDocumentButton
                      category="annual_exam"
                      documentId={exam.id}
                      label={exam.fileName}
                      onPreview={setPreview}
                      patientId={patientId}
                      role={role}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTable colSpan={role === "student" ? 5 : 4} label="No annual exam results recorded." />
            )}
          </TableBody>
        </Table>
        <TablePager
          page={page}
          setPage={changeExamPage}
          totalItems={exams.length}
          totalPages={paged.totalPages}
        />
        {preview && (
          <InlineProtectedDocumentPreview
            onClose={() => setPreview(null)}
            preview={preview}
          />
        )}
      </CardContent>

      <ExamUploadDialog
        onChanged={onChanged}
        onOpenChange={setOpen}
        open={open}
        patientId={patientId}
        role={role}
      />
    </Card>
  )
}

// Renders Sick Leave history and clinic-role upload controls.
function SickLeavePanel({
  canAdd,
  entries,
  onChanged,
  page,
  patientId,
  role,
  setPage,
}: {
  canAdd: boolean
  entries: SickLeaveDTO[]
  onChanged?: () => Promise<void> | void
  page: number
  patientId: string
  role: "faculty" | "staff"
  setPage: (page: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ProtectedDocumentPreview | null>(null)
  const paged = usePagedRows(entries, page)

  // Changes Sick Leave pages and closes a preview from the previous page.
  function changeLeavePage(nextPage: number) {
    setPreview(null)
    setPage(nextPage)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Sick Leave Log</CardTitle>
            <CardDescription>
              Clinic-authored leave periods and supporting certificates.
            </CardDescription>
          </div>
          {canAdd && (
            <Button onClick={() => setOpen(true)} size="sm" type="button">
              <Plus className="size-4" />
              Add sick leave
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date range</TableHead>
              <TableHead>Reason / diagnosis</TableHead>
              <TableHead>Recorded</TableHead>
              <TableHead className="w-28">Certificate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.length ? (
              paged.rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {formatDate(entry.startDate)} – {formatDate(entry.endDate)}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {entry.reasonDiagnosis}
                  </TableCell>
                  <TableCell>{formatDate(entry.createdAt)}</TableCell>
                  <TableCell>
                    <ProtectedDocumentButton
                      category="sick_leave"
                      documentId={entry.id}
                      label={entry.fileName}
                      onPreview={setPreview}
                      patientId={patientId}
                      role={role}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTable colSpan={4} label="No sick leave entries recorded." />
            )}
          </TableBody>
        </Table>
        <TablePager
          page={page}
          setPage={changeLeavePage}
          totalItems={entries.length}
          totalPages={paged.totalPages}
        />
        {preview && (
          <InlineProtectedDocumentPreview
            onClose={() => setPreview(null)}
            preview={preview}
          />
        )}
      </CardContent>

      <SickLeaveDialog
        onChanged={onChanged}
        onOpenChange={setOpen}
        open={open}
        patientId={patientId}
        role={role}
      />
    </Card>
  )
}

// Renders the read-only aggregate of generic and compliance documents.
function DocumentsPanel({
  canAdd,
  documents,
  onChanged,
  page,
  patientId,
  role,
  setPage,
}: {
  canAdd: boolean
  documents: ComplianceDocumentDTO[]
  onChanged?: () => Promise<void> | void
  page: number
  patientId: string
  role: PatientProfileRole
  setPage: (page: number) => void
}) {
  const paged = usePagedRows(documents, page)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ProtectedDocumentPreview | null>(null)

  // Changes document pages and closes a preview from the previous page.
  function changeDocumentPage(nextPage: number) {
    setPreview(null)
    setPage(nextPage)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Medical attachments, exam results, and leave certificates.
            </CardDescription>
          </div>
          {canAdd && (
            <Button onClick={() => setOpen(true)} size="sm" type="button">
              <Plus className="size-4" />
              Add document
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-28">File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.length ? (
              paged.rows.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{document.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {document.fileName}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="capitalize" variant="outline">
                      {document.category.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(document.createdAt)}</TableCell>
                  <TableCell>
                    <ProtectedDocumentButton
                      category={document.category}
                      documentId={document.id.split(":").at(-1) ?? document.id}
                      label={document.fileName}
                      onPreview={setPreview}
                      patientId={patientId}
                      role={role}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTable colSpan={4} label="No documents are available." />
            )}
          </TableBody>
        </Table>
        <TablePager
          page={page}
          setPage={changeDocumentPage}
          totalItems={documents.length}
          totalPages={paged.totalPages}
        />
        {preview && (
          <InlineProtectedDocumentPreview
            onClose={() => setPreview(null)}
            preview={preview}
          />
        )}
      </CardContent>
      <DocumentUploadDialog
        onChanged={onChanged}
        onOpenChange={setOpen}
        open={open}
        patientId={patientId}
        role={role}
      />
    </Card>
  )
}

// Uploads one private generic attachment from the Documents tab.
function DocumentUploadDialog({
  onChanged,
  onOpenChange,
  open,
  patientId,
  role,
}: {
  onChanged?: () => Promise<void> | void
  onOpenChange: (open: boolean) => void
  open: boolean
  patientId: string
  role: PatientProfileRole
}) {
  const [submitting, setSubmitting] = useState(false)

  // Validates and uploads one patient document through the protected action.
  async function submitDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set("patientId", patientId)
    formData.set("patientRole", role)
    const result = await uploadGeneralDocumentAction(formData)
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Document added")
    form.reset()
    onOpenChange(false)
    await onChanged?.()
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
          <DialogDescription>
            Upload a private supporting document. PDF, JPEG, or PNG; 10 MB max.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitDocument}>
          <FormField label="Document type">
            <Input
              maxLength={200}
              name="documentType"
              placeholder="Laboratory result, referral, or certificate"
              required
            />
          </FormField>
          <FormField label="Document file">
            <Input
              accept=".pdf,.jpg,.jpeg,.png"
              name="file"
              required
              type="file"
            />
          </FormField>
          <DialogFooter>
            <Button disabled={submitting} type="submit">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Upload document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Renders the Admin and Doctor Annual Medical Exam form.
function ExamUploadDialog({
  onChanged,
  onOpenChange,
  open,
  patientId,
  role,
}: {
  onChanged?: () => Promise<void> | void
  onOpenChange: (open: boolean) => void
  open: boolean
  patientId: string
  role: PatientProfileRole
}) {
  const [submitting, setSubmitting] = useState(false)
  const [resultStatus, setResultStatus] = useState("pending")

  // Validates and uploads a new annual exam result.
  async function submitExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set("patientId", patientId)
    formData.set("patientRole", role)
    if (role === "student") {
      formData.set("clinicalResultStatus", resultStatus)
    }
    const result = await uploadMedicalExamAction(formData)
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Annual medical exam result added")
    form.reset()
    onOpenChange(false)
    await onChanged?.()
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Annual Medical Exam</DialogTitle>
          <DialogDescription>
            Upload the verified third-party result. PDF, JPEG, or PNG; 10 MB max.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitExam}>
          {role === "student" ? (
            <>
              <FormField label="School year">
                <Input name="schoolYear" placeholder="2026–2027" required />
              </FormField>
              <FormField label="Semester">
                <Input name="semester" placeholder="First Semester" required />
              </FormField>
              <FormField label="Clinical result">
                <Select onValueChange={(value) => setResultStatus(String(value))} value={resultStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleared">Cleared</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="not_cleared">Not Cleared</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </>
          ) : (
            <FormField label="Calendar year">
              <Input
                defaultValue={new Date().getFullYear()}
                max="2200"
                min="2000"
                name="calendarYear"
                required
                type="number"
              />
            </FormField>
          )}
          <FormField label="Exam details">
            <Textarea name="examDetails" required rows={4} />
          </FormField>
          <FormField label="Result file">
            <Input accept=".pdf,.jpg,.jpeg,.png" name="file" required type="file" />
          </FormField>
          <DialogFooter>
            <Button disabled={submitting} type="submit">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Upload result
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Renders the clinic-role Sick Leave certificate form.
function SickLeaveDialog({
  onChanged,
  onOpenChange,
  open,
  patientId,
  role,
}: {
  onChanged?: () => Promise<void> | void
  onOpenChange: (open: boolean) => void
  open: boolean
  patientId: string
  role: "faculty" | "staff"
}) {
  const [submitting, setSubmitting] = useState(false)

  // Validates and uploads one new Sick Leave entry.
  async function submitLeave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set("patientId", patientId)
    formData.set("patientRole", role)
    const result = await uploadSickLeaveAction(formData)
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Sick leave entry added")
    form.reset()
    onOpenChange(false)
    await onChanged?.()
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Sick Leave Entry</DialogTitle>
          <DialogDescription>
            Record the approved leave period and private certificate file.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitLeave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start date">
              <Input name="startDate" required type="date" />
            </FormField>
            <FormField label="End date">
              <Input name="endDate" required type="date" />
            </FormField>
          </div>
          <FormField label="Reason / diagnosis">
            <Textarea name="reasonDiagnosis" required rows={4} />
          </FormField>
          <FormField label="Certificate file">
            <Input accept=".pdf,.jpg,.jpeg,.png" name="file" required type="file" />
          </FormField>
          <DialogFooter>
            <Button disabled={submitting} type="submit">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Add sick leave
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Wraps a labeled form control with consistent spacing.
function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

// Renders the derived Employee annual-compliance state.
function ComplianceStatusBadge({
  status,
}: {
  status: NonNullable<ComplianceRecordDTO["employeeStatus"]>
}) {
  const label =
    status === "completed"
      ? "Completed"
      : status === "due_soon"
        ? "Due Soon"
        : "Overdue"
  return (
    <Badge variant={status === "completed" ? "secondary" : "destructive"}>
      {label}
    </Badge>
  )
}

// Renders a Student exam clearance result.
function StudentResultBadge({
  status,
}: {
  status: MedicalExamDTO["clinicalResultStatus"]
}) {
  const label =
    status === "cleared"
      ? "Cleared"
      : status === "not_cleared"
        ? "Not Cleared"
        : "Pending"
  return <Badge variant={status === "cleared" ? "secondary" : "outline"}>{label}</Badge>
}

interface ProtectedDocumentPreview {
  documentId: string
  category: ComplianceDocumentDTO["category"]
  url: string
  fileName: string
  mimeType: string | null
}

// Renders a protected file directly beneath the table that selected it.
function InlineProtectedDocumentPreview({
  preview,
  onClose,
}: {
  preview: ProtectedDocumentPreview
  onClose: () => void
}) {
  return (
    <section
      aria-label={`Preview of ${preview.fileName}`}
      className="space-y-4 border-t border-border pt-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="break-all font-semibold">{preview.fileName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Protected preview. The access link expires after five minutes.
          </p>
        </div>
        <Button
          aria-label="Close document preview"
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </div>
      <AttachmentCarousel
        attachments={[
          {
            id: preview.documentId,
            file_name: preview.fileName,
            file_url: preview.url,
            mime_type: preview.mimeType,
            document_type: preview.category,
          },
        ]}
      />
      <div className="flex justify-end">
        <a
          className={buttonVariants()}
          download={preview.fileName}
          href={preview.url}
          rel="noreferrer"
          target="_blank"
        >
          <Download className="size-4" />
          Download
        </a>
      </div>
    </section>
  )
}

// Requests a fresh protected URL before rendering an inline document preview.
function ProtectedDocumentButton({
  category,
  documentId,
  label,
  onPreview,
  patientId,
  role,
}: {
  category: ComplianceDocumentDTO["category"]
  documentId: string
  label: string
  onPreview: (preview: ProtectedDocumentPreview) => void
  patientId: string
  role: PatientProfileRole
}) {
  const [loading, setLoading] = useState(false)

  // Reauthorizes the selected file and sends its short-lived URL to the panel.
  async function openPreview() {
    setLoading(true)
    const result = await getComplianceDocumentUrlAction({
      category,
      documentId,
      patientId,
      patientRole: role,
    })
    setLoading(false)
    if (result.error || !result.url) {
      toast.error(result.error ?? "Document unavailable")
      return
    }
    onPreview({
      documentId,
      category,
      url: result.url,
      fileName: result.fileName ?? label,
      mimeType: result.mimeType,
    })
  }

  return (
    <Button
      aria-label={`Preview ${label}`}
      disabled={loading}
      onClick={() => void openPreview()}
      size="sm"
      type="button"
      variant="ghost"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileText className="size-4" />
      )}
      Preview
    </Button>
  )
}

// Renders an accessible empty table row.
function EmptyTable({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell className="py-12 text-center text-muted-foreground" colSpan={colSpan}>
        <FileCheck2 className="mx-auto mb-2 size-6" />
        {label}
      </TableCell>
    </TableRow>
  )
}

// Renders hidden-below-one-page boundary-safe list controls.
function TablePager({
  page,
  setPage,
  totalItems,
  totalPages,
}: {
  page: number
  setPage: (page: number) => void
  totalItems: number
  totalPages: number
}) {
  return (
    <DataTablePagination
      currentPage={page}
      onPageChange={setPage}
      pageSize={PAGE_SIZE}
      totalItems={totalItems}
      totalPages={totalPages}
    />
  )
}

// Returns a stable local page for one tab's records.
function usePagedRows<T>(rows: T[], page: number) {
  return useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return {
      rows: rows.slice(start, start + PAGE_SIZE),
      totalPages,
    }
  }, [page, rows])
}

// Formats database dates consistently for record tables.
function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// Formats a consultation timestamp using the user's local clinic display.
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
