"use client"

import { Check, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ConsultationWizardStep =
  | "details"
  | "vitals"
  | "notes"
  | "diagnosis"
  | "prescription"
  | "follow_up"
  | "review"

const steps: Array<{ key: ConsultationWizardStep; label: string }> = [
  { key: "details", label: "Visit" },
  { key: "vitals", label: "Vitals" },
  { key: "notes", label: "Notes" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "prescription", label: "Prescription" },
  { key: "follow_up", label: "Follow-up" },
  { key: "review", label: "Review" },
]

interface ConsultationWizardShellProps {
  open: boolean
  patientName: string
  step: ConsultationWizardStep
  onOpenChange: (open: boolean) => void
  onStepChange: (step: ConsultationWizardStep) => void
  onSaveAndExit: () => void
  onComplete?: () => void
  children: React.ReactNode
}

// Renders the reusable modal frame and navigation for clinical consultation steps.
export function ConsultationWizardShell({
  open,
  patientName,
  step,
  onOpenChange,
  onStepChange,
  onSaveAndExit,
  onComplete,
  children,
}: ConsultationWizardShellProps) {
  const index = steps.findIndex((item) => item.key === step)
  const isLastStep = index === steps.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[98vw] sm:w-[95vw] sm:max-w-[95vw] md:w-[90vw] md:max-w-[90vw] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle>Consultation</DialogTitle>
          <DialogDescription>{patientName}</DialogDescription>
        </DialogHeader>

        <ol
          className="flex items-center justify-center gap-0 py-2"
          aria-label="Consultation progress"
        >
          {steps.map((item, itemIndex) => {
            const isCurrent = itemIndex === index
            const isComplete = itemIndex < index
            return (
              <li key={item.key} className="flex items-center">
                {itemIndex > 0 && (
                  <div
                    className={`h-px w-8 mx-1 ${
                      isComplete ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onStepChange(item.key)}
                    className={`size-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors cursor-pointer ${
                      isComplete
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                          : "bg-field text-muted-foreground border border-border"
                    }`}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`Step ${itemIndex + 1}: ${item.label}`}
                  >
                    {isComplete ? <Check className="size-3" /> : itemIndex + 1}
                  </button>
                  <span
                    className={`text-[10px] leading-4 whitespace-nowrap ${
                      isCurrent || isComplete
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>

        <section className="min-h-72 border-y border-border py-6">
          {children}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          {index > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onStepChange(steps[index - 1].key)}
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {!isLastStep && (
              <Button type="button" variant="outline" onClick={onSaveAndExit}>
                <X className="size-4" /> Save and exit
              </Button>
            )}
            {isLastStep && onComplete ? (
              <Button type="button" onClick={onComplete}>
                Complete consultation
              </Button>
            ) : (
              !isLastStep && (
                <Button
                  type="button"
                  onClick={() => onStepChange(steps[index + 1].key)}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}