"use client"

import { Check, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ClinicalWorkflowRole = "doctor" | "nurse"
export type ConsultationWizardStep =
  | "details"
  | "vitals"
  | "notes"
  | "clinical_plan"
  | "review"

const doctorSteps: Array<{ key: ConsultationWizardStep; label: string }> = [
  { key: "details", label: "Visit" },
  { key: "vitals", label: "Vitals" },
  { key: "notes", label: "Notes" },
  { key: "clinical_plan", label: "Clinical plan" },
  { key: "review", label: "Review" },
]

const nurseSteps: Array<{ key: ConsultationWizardStep; label: string }> = [
  { key: "details", label: "Visit" },
  { key: "vitals", label: "Vitals" },
  { key: "notes", label: "Notes" },
  { key: "review", label: "Review" },
]

interface ConsultationWizardShellProps {
  open: boolean
  patientName: string
  role: ClinicalWorkflowRole
  step: ConsultationWizardStep
  onOpenChange: (open: boolean) => void
  onStepChange: (step: ConsultationWizardStep) => void
  onRequestClose: () => void
  onSubmitReview: () => void
  submitting: boolean
  children: React.ReactNode
}

// Renders role-safe steps and a single review submission control.
export function ConsultationWizardShell({
  open,
  patientName,
  role,
  step,
  onOpenChange,
  onStepChange,
  onRequestClose,
  onSubmitReview,
  submitting,
  children,
}: ConsultationWizardShellProps) {
  const steps = role === "doctor" ? doctorSteps : nurseSteps
  const index = steps.findIndex((item) => item.key === step)
  const isLastStep = index === steps.length - 1

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true)
        else onRequestClose()
      }}
    >
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-4xl overflow-y-auto p-5 sm:p-7">
        <DialogHeader>
          <DialogTitle>Consultation</DialogTitle>
          <DialogDescription>{patientName}</DialogDescription>
        </DialogHeader>

        <ol className="flex items-start gap-1 overflow-x-auto pb-2" aria-label="Consultation progress">
          {steps.map((item, itemIndex) => {
            const isCurrent = itemIndex === index
            const isComplete = itemIndex < index
            return (
              <li key={item.key} className="flex min-w-14 flex-1 items-center">
                {itemIndex > 0 && (
                  <div className={`mt-[-18px] h-px flex-1 ${isComplete ? "bg-primary" : "bg-border"}`} />
                )}
                <button
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${itemIndex + 1}: ${item.label}`}
                  className="flex min-w-14 flex-col items-center gap-1 text-xs focus-visible:outline-none"
                  key={item.key}
                  onClick={() => onStepChange(item.key)}
                  type="button"
                >
                  <span className={`flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${isComplete || isCurrent ? "border-primary bg-primary text-primary-foreground" : "border-border bg-field text-muted-foreground"}`}>
                    {isComplete ? <Check className="size-3.5" /> : itemIndex + 1}
                  </span>
                  <span className={isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ol>

        <section className="min-h-72 border-y border-border py-5">{children}</section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {index > 0 ? (
            <Button onClick={() => onStepChange(steps[index - 1].key)} type="button" variant="outline">
              <ChevronLeft className="size-4" />
              Back
            </Button>
          ) : (
            <Button onClick={onRequestClose} type="button" variant="ghost">
              Cancel
            </Button>
          )}
          {isLastStep ? (
            <Button disabled={submitting} onClick={onSubmitReview} type="button">
              {submitting
                ? "Submitting..."
                : role === "doctor"
                  ? "Complete consultation"
                  : "Submit for doctor review"}
            </Button>
          ) : (
            <Button onClick={() => onStepChange(steps[index + 1].key)} type="button">
              Next
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
