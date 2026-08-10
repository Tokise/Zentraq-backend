"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type ClinicalWorkflowRole = "admin" | "doctor" | "nurse"
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
  const steps = role === "nurse" ? nurseSteps : doctorSteps
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
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto p-5 sm:max-w-5xl sm:p-7">
        <DialogHeader>
          <DialogTitle>Consultation</DialogTitle>
          <DialogDescription>{patientName}</DialogDescription>
        </DialogHeader>

        <Tabs
          onValueChange={(value) =>
            onStepChange(value as ConsultationWizardStep)
          }
          value={step}
        >
          <TabsList
            aria-label="Consultation workflow"
            className={cn(
              "grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 group-data-horizontal/tabs:h-auto",
              role === "nurse" ? "sm:grid-cols-4" : "sm:grid-cols-5",
            )}
          >
            {steps.map((item) => (
              <TabsTrigger
                className="min-h-11 w-full rounded-lg px-3 py-2 text-center whitespace-normal data-active:shadow-sm"
                key={item.key}
                value={item.key}
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={step}>
            <section className="min-h-72 border-y border-border py-5">
              {children}
            </section>
          </TabsContent>
        </Tabs>

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
                : role === "nurse"
                  ? "Submit for doctor review"
                  : "Complete consultation"}
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
