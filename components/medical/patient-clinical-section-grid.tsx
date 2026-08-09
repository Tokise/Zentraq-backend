"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Pill,
  Plus,
  Syringe,
} from "lucide-react"
import { toast } from "sonner"

import {
  addMedicalHistory,
  addPatientAllergy,
  addPatientImmunization,
  addPatientMedication,
  type PatientMedicalRecord,
} from "@/actions/clinical/records"
import { SensitiveField } from "@/components/common/sensitive-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ClinicalSection =
  | "history"
  | "allergies"
  | "medications"
  | "immunizations"

interface PatientClinicalSectionGridProps {
  record: PatientMedicalRecord
  canEdit: boolean
  onUpdated?: () => Promise<void> | void
}

const sectionLabels: Record<ClinicalSection, string> = {
  history: "Medical history",
  allergies: "Allergies",
  medications: "Current medications",
  immunizations: "Immunizations",
}

// Renders a read-only or editable clinical-summary card grid for a patient.
export function PatientClinicalSectionGrid({
  record,
  canEdit,
  onUpdated,
}: PatientClinicalSectionGridProps) {
  const [openSection, setOpenSection] = useState<ClinicalSection | null>(null)
  const [addSection, setAddSection] = useState<ClinicalSection | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [historyForm, setHistoryForm] = useState({
    condition_name: "",
    diagnosed_date: "",
    status: "active",
    notes: "",
  })
  const [allergyForm, setAllergyForm] = useState({
    allergen: "",
    reaction: "",
    severity: "mild",
    notes: "",
  })
  const [medicationForm, setMedicationForm] = useState({
    medicine_name: "",
    dosage: "",
    frequency: "",
    start_date: "",
    end_date: "",
    notes: "",
  })
  const [immunizationForm, setImmunizationForm] = useState({
    vaccine_name: "",
    administered_date: "",
    dose_number: "",
    lot_number: "",
    notes: "",
  })

  // Opens a detail dialog for the selected clinical section.
  function openDetails(section: ClinicalSection) {
    setOpenSection(section)
  }

  // Opens an add form without allowing the card click to bubble.
  function openAdd(
    event: React.MouseEvent<HTMLButtonElement>,
    section: ClinicalSection,
  ) {
    event.stopPropagation()
    setOpenSection(null)
    setAddSection(section)
  }

  // Persists the selected clinical entry through the authorized server action.
  async function saveEntry() {
    if (!addSection) return
    setIsSaving(true)

    try {
      let result: { error: string | null }

      if (addSection === "history") {
        if (!historyForm.condition_name.trim()) {
          toast.error("Condition name is required")
          return
        }
        result = await addMedicalHistory(
          record.patient_id,
          record.patient_type,
          historyForm,
        )
      } else if (addSection === "allergies") {
        if (!allergyForm.allergen.trim()) {
          toast.error("Allergen is required")
          return
        }
        result = await addPatientAllergy(
          record.patient_id,
          record.patient_type,
          allergyForm,
        )
      } else if (addSection === "medications") {
        if (!medicationForm.medicine_name.trim()) {
          toast.error("Medicine name is required")
          return
        }
        result = await addPatientMedication(
          record.patient_id,
          record.patient_type,
          medicationForm,
        )
      } else {
        if (!immunizationForm.vaccine_name.trim()) {
          toast.error("Vaccine name is required")
          return
        }
        result = await addPatientImmunization(
          record.patient_id,
          record.patient_type,
          {
            ...immunizationForm,
            dose_number: immunizationForm.dose_number
              ? Number(immunizationForm.dose_number)
              : undefined,
          },
        )
      }

      if (result.error) {
        toast.error(result.error)
        return
      }

      setAddSection(null)
      await onUpdated?.()
      toast.success(`${sectionLabels[addSection]} updated`)
    } catch {
      toast.error("Unable to save the clinical record")
    } finally {
      setIsSaving(false)
    }
  }

  // Produces a short, non-sensitive count summary for each card.
  function getSummary(section: ClinicalSection) {
    const count =
      section === "history"
        ? record.medical_history.length
        : section === "allergies"
          ? record.allergies.length
          : section === "medications"
            ? record.medications.length
            : record.immunizations.length

    return count === 0
      ? `No ${sectionLabels[section].toLowerCase()} recorded.`
      : `${count} ${count === 1 ? "entry" : "entries"} recorded.`
  }

  // Renders the full detail content for the active modal section.
  function renderDetails(section: ClinicalSection) {
    if (section === "history") {
      return record.medical_history.length ? (
        record.medical_history.map((item) => (
          <article key={item.id} className="border-b border-border py-4 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <SensitiveField value={item.condition} className="font-medium" />
              <span className="text-xs capitalize text-muted-foreground">{item.status}</span>
            </div>
            {item.diagnosed_date && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="size-3" />
                Diagnosed {new Date(item.diagnosed_date).toLocaleDateString()}
              </p>
            )}
            {item.notes && <SensitiveField value={item.notes} className="mt-2 block text-sm text-muted-foreground" />}
          </article>
        ))
      ) : <EmptySection label="medical history" />
    }

    if (section === "allergies") {
      return record.allergies.length ? (
        record.allergies.map((item) => (
          <article key={item.id} className="border-b border-border py-4 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <SensitiveField value={item.allergen} className="font-medium" />
              {item.severity && <span className="text-xs capitalize text-destructive">{item.severity}</span>}
            </div>
            {item.reaction && <SensitiveField value={`Reaction: ${item.reaction}`} className="mt-2 block text-sm text-muted-foreground" />}
            {item.notes && <SensitiveField value={item.notes} className="mt-2 block text-sm text-muted-foreground" />}
          </article>
        ))
      ) : <EmptySection label="allergies" />
    }

    if (section === "medications") {
      return record.medications.length ? (
        record.medications.map((item) => (
          <article key={item.id} className="border-b border-border py-4 last:border-b-0">
            <SensitiveField value={item.medicine_name} className="font-medium" />
            {(item.dosage || item.frequency) && (
              <SensitiveField
                value={[item.dosage, item.frequency].filter(Boolean).join(" · ")}
                className="mt-2 block text-sm text-muted-foreground"
              />
            )}
            {item.notes && <SensitiveField value={item.notes} className="mt-2 block text-sm text-muted-foreground" />}
          </article>
        ))
      ) : <EmptySection label="current medications" />
    }

    return record.immunizations.length ? (
      record.immunizations.map((item) => (
        <article key={item.id} className="border-b border-border py-4 last:border-b-0">
          <SensitiveField value={item.vaccine_name} className="font-medium" />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.dose_number && <span>Dose {item.dose_number}</span>}
            {item.administered_date && <span>{new Date(item.administered_date).toLocaleDateString()}</span>}
            {item.lot_number && <SensitiveField value={`Lot ${item.lot_number}`} />}
          </div>
          {item.notes && <SensitiveField value={item.notes} className="mt-2 block text-sm text-muted-foreground" />}
        </article>
      ))
    ) : <EmptySection label="immunizations" />
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["history", "allergies", "medications", "immunizations"] as ClinicalSection[]).map((section) => {
          const hasSevereAllergy =
            section === "allergies" &&
            record.allergies.some((item) => item.severity === "severe" || item.severity === "critical")
          const Icon = section === "history"
            ? ClipboardList
            : section === "allergies"
              ? AlertTriangle
              : section === "medications"
                ? Pill
                : Syringe

          return (
            <article
              key={section}
              tabIndex={0}
              role="button"
              onClick={() => openDetails(section)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  openDetails(section)
                }
              }}
              className="min-h-44 cursor-pointer bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className={hasSevereAllergy ? "size-4 text-destructive" : "size-4 text-primary"} />
                  <h3 className="font-semibold">{sectionLabels[section]}</h3>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(event) => openAdd(event, section)}
                  >
                    <Plus className="size-3.5" />
                    Add {section === "history" ? "condition" : section.slice(0, -1)}
                  </Button>
                )}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">{getSummary(section)}</p>
              <p className="mt-3 text-xs text-primary">View details</p>
            </article>
          )
        })}
      </div>

      <Dialog open={openSection !== null} onOpenChange={(open) => !open && setOpenSection(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          {openSection && (
            <>
              <DialogHeader>
                <DialogTitle>{sectionLabels[openSection]}</DialogTitle>
                <DialogDescription>Full patient clinical record for this section.</DialogDescription>
              </DialogHeader>
              <div>{renderDetails(openSection)}</div>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddSection(openSection)
                    setOpenSection(null)
                  }}
                >
                  <Plus className="size-4" />
                  Add {openSection === "history" ? "condition" : openSection.slice(0, -1)}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addSection !== null} onOpenChange={(open) => !open && setAddSection(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          {addSection && (
            <>
              <DialogHeader>
                <DialogTitle>Add {sectionLabels[addSection].toLowerCase()}</DialogTitle>
                <DialogDescription>Changes are recorded in the patient audit log.</DialogDescription>
              </DialogHeader>
              {addSection === "history" && <HistoryForm form={historyForm} onChange={setHistoryForm} />}
              {addSection === "allergies" && <AllergyForm form={allergyForm} onChange={setAllergyForm} />}
              {addSection === "medications" && <MedicationForm form={medicationForm} onChange={setMedicationForm} />}
              {addSection === "immunizations" && <ImmunizationForm form={immunizationForm} onChange={setImmunizationForm} />}
              <Button type="button" className="w-full" disabled={isSaving} onClick={saveEntry}>
                {isSaving ? "Saving…" : `Add ${sectionLabels[addSection].toLowerCase()}`}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// Renders the empty state shared by clinical detail dialogs.
function EmptySection({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">No {label} recorded.</p>
}

// Renders the medical-history entry form.
function HistoryForm({ form, onChange }: { form: Record<string, string>; onChange: React.Dispatch<React.SetStateAction<any>> }) {
  return <div className="space-y-4"><Field label="Condition name" value={form.condition_name} onChange={(condition_name) => onChange({ ...form, condition_name })} /><Field label="Diagnosed date" type="date" value={form.diagnosed_date} onChange={(diagnosed_date) => onChange({ ...form, diagnosed_date })} /><SelectField label="Status" value={form.status} onChange={(status) => onChange({ ...form, status })} options={["active", "resolved", "chronic"]} /><NotesField value={form.notes} onChange={(notes) => onChange({ ...form, notes })} /></div>
}

// Renders the allergy entry form.
function AllergyForm({ form, onChange }: { form: Record<string, string>; onChange: React.Dispatch<React.SetStateAction<any>> }) {
  return <div className="space-y-4"><Field label="Allergen" value={form.allergen} onChange={(allergen) => onChange({ ...form, allergen })} /><Field label="Reaction" value={form.reaction} onChange={(reaction) => onChange({ ...form, reaction })} /><SelectField label="Severity" value={form.severity} onChange={(severity) => onChange({ ...form, severity })} options={["mild", "moderate", "severe", "critical"]} /><NotesField value={form.notes} onChange={(notes) => onChange({ ...form, notes })} /></div>
}

// Renders the medication entry form.
function MedicationForm({ form, onChange }: { form: Record<string, string>; onChange: React.Dispatch<React.SetStateAction<any>> }) {
  return <div className="space-y-4"><Field label="Medicine name" value={form.medicine_name} onChange={(medicine_name) => onChange({ ...form, medicine_name })} /><Field label="Dosage" value={form.dosage} onChange={(dosage) => onChange({ ...form, dosage })} /><Field label="Frequency" value={form.frequency} onChange={(frequency) => onChange({ ...form, frequency })} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Start date" type="date" value={form.start_date} onChange={(start_date) => onChange({ ...form, start_date })} /><Field label="End date" type="date" value={form.end_date} onChange={(end_date) => onChange({ ...form, end_date })} /></div><NotesField value={form.notes} onChange={(notes) => onChange({ ...form, notes })} /></div>
}

// Renders the immunization entry form.
function ImmunizationForm({ form, onChange }: { form: Record<string, string>; onChange: React.Dispatch<React.SetStateAction<any>> }) {
  return <div className="space-y-4"><Field label="Vaccine name" value={form.vaccine_name} onChange={(vaccine_name) => onChange({ ...form, vaccine_name })} /><Field label="Date administered" type="date" value={form.administered_date} onChange={(administered_date) => onChange({ ...form, administered_date })} /><Field label="Dose number" type="number" value={form.dose_number} onChange={(dose_number) => onChange({ ...form, dose_number })} /><Field label="Lot number" value={form.lot_number} onChange={(lot_number) => onChange({ ...form, lot_number })} /><NotesField value={form.notes} onChange={(notes) => onChange({ ...form, notes })} /></div>
}

// Renders a labelled input field for clinical entry forms.
function Field({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replaceAll(" ", "-")
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>
}

// Renders a labelled select field for constrained clinical values.
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  const id = label.toLowerCase().replaceAll(" ", "-")
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full border border-border bg-field px-3 text-sm"><option value="">Select a value</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
}

// Renders a labelled notes field for clinical entry forms.
function NotesField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="space-y-1.5"><Label htmlFor="clinical-notes">Notes</Label><Textarea id="clinical-notes" value={value} onChange={(event) => onChange(event.target.value)} /></div>
}
