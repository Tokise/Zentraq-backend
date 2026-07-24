"use client"

import { useState } from "react"
import { Check, ChevronLeft, ChevronRight, ClipboardList, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export type CompletionReport = {
    diagnosis: string
    treatment: string
    recommendations: string
}

type Step = "complaint" | "report" | "review"

const STEPS: { key: Step; label: string; icon: typeof ClipboardList }[] = [
    { key: "complaint", label: "Complaint", icon: ClipboardList },
    { key: "report", label: "Report", icon: FileText },
    { key: "review", label: "Review", icon: Check },
]

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    patientName: string
    initialComplaint: string
    initialReport?: CompletionReport
    onComplete: (complaint: string, report: CompletionReport) => Promise<void>
    mode?: "consultation" | "emergency"
}

export function ConsultationWizard({
    open,
    onOpenChange,
    patientName,
    initialComplaint,
    initialReport,
    onComplete,
    mode = "consultation",
}: Props) {
    const [step, setStep] = useState<Step>("complaint")
    const [complaint, setComplaint] = useState(initialComplaint)
    const [report, setReport] = useState<CompletionReport>(
        initialReport || { diagnosis: "", treatment: "", recommendations: "" }
    )
    const [submitting, setSubmitting] = useState(false)

    // Reset when dialog opens with new data
    const [lastInitialComplaint, setLastInitialComplaint] = useState(initialComplaint)
    if (open && initialComplaint !== lastInitialComplaint) {
        setComplaint(initialComplaint)
        setReport(initialReport || { diagnosis: "", treatment: "", recommendations: "" })
        setStep("complaint")
        setLastInitialComplaint(initialComplaint)
    }

    const stepIndex = STEPS.findIndex((s) => s.key === step)

    function goTo(s: Step) {
        setStep(s)
    }

    function canProceedFromComplaint(): boolean {
        return complaint.trim().length > 0
    }

    function canProceedFromReport(): boolean {
        return report.diagnosis.trim().length > 0 &&
            report.treatment.trim().length > 0 &&
            report.recommendations.trim().length > 0
    }

    async function handleSubmit() {
        if (submitting) return
        setSubmitting(true)
        try {
            await onComplete(complaint.trim(), report)
            // Reset state after successful completion
            setStep("complaint")
            setComplaint("")
            setReport({ diagnosis: "", treatment: "", recommendations: "" })
        } catch (err: any) {
            toast.error(err.message || "Failed to save")
        } finally {
            setSubmitting(false)
        }
    }

    function handleClose() {
        // Don't reset — draft persists
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "emergency" ? "Handle Emergency Case" : "Complete Consultation"}
                    </DialogTitle>
                    <DialogDescription>
                        Patient: <span className="font-medium">{patientName}</span>
                    </DialogDescription>
                </DialogHeader>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-0 py-2">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon
                        const isActive = step === s.key
                        const isDone = stepIndex > i
                        return (
                            <div key={s.key} className="flex items-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (i < stepIndex || (i === 1 && canProceedFromComplaint()) || (i === 2 && canProceedFromReport())) {
                                            goTo(s.key)
                                        }
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer rounded-full text-xs font-medium transition-colors ${isActive
                                        ? "bg-primary text-primary-foreground"
                                        : isDone
                                            ? "bg-primary/10 text-primary"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                >
                                    <Icon className="size-3" />
                                    {s.label}
                                </button>
                                {i < STEPS.length - 1 && (
                                    <div className={`h-px w-6 mx-1 ${isDone || (stepIndex > i) ? "bg-primary" : "bg-border"}`} />
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Step Content */}
                <div className="min-h-[250px]">
                    {step === "complaint" && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Student Complaint <span className="text-destructive">*</span>
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Update the complaint based on your assessment.
                                </p>
                                <Input
                                    value={complaint}
                                    onChange={(e) => setComplaint(e.target.value)}
                                    placeholder="Enter or update the chief complaint..."
                                />
                            </div>
                        </div>
                    )}

                    {step === "report" && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Diagnosis / Findings <span className="text-destructive">*</span>
                                </label>
                                <textarea
                                    value={report.diagnosis}
                                    onChange={(e) => setReport({ ...report, diagnosis: e.target.value })}
                                    placeholder="Describe the diagnosis and findings..."
                                    required
                                    rows={3}
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Treatment Given <span className="text-destructive">*</span>
                                </label>
                                <textarea
                                    value={report.treatment}
                                    onChange={(e) => setReport({ ...report, treatment: e.target.value })}
                                    placeholder="Medication, procedure, or care provided..."
                                    required
                                    rows={3}
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Recommendations <span className="text-destructive">*</span>
                                </label>
                                <textarea
                                    value={report.recommendations}
                                    onChange={(e) => setReport({ ...report, recommendations: e.target.value })}
                                    placeholder="Follow-up, rest, referral, etc..."
                                    required
                                    rows={3}
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                        </div>
                    )}

                    {step === "review" && (
                        <div className="space-y-4 py-4">
                            <div className="rounded-md border border-border p-3 space-y-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Student Complaint</p>
                                    <p className="text-sm font-medium">{complaint}</p>
                                </div>
                                <div className="border-t border-border pt-3">
                                    <p className="text-xs text-muted-foreground">Diagnosis / Findings</p>
                                    <p className="text-sm">{report.diagnosis}</p>
                                </div>
                                <div className="border-t border-border pt-3">
                                    <p className="text-xs text-muted-foreground">Treatment Given</p>
                                    <p className="text-sm">{report.treatment}</p>
                                </div>
                                <div className="border-t border-border pt-3">
                                    <p className="text-xs text-muted-foreground">Recommendations</p>
                                    <p className="text-sm">{report.recommendations}</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Review the details above. Click "Complete" to finalize.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t border-border pt-4">
                    <div className="flex w-full items-center justify-between">
                        <div>
                            {stepIndex > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => goTo(STEPS[stepIndex - 1].key)}
                                >
                                    <ChevronLeft className="size-4" />
                                    Back
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleClose}>
                                {step === "review" ? "Close (Draft Saved)" : "Save Draft"}
                            </Button>
                            {step === "complaint" && (
                                <Button
                                    size="sm"
                                    disabled={!canProceedFromComplaint()}
                                    onClick={() => goTo("report")}
                                >
                                    Next
                                    <ChevronRight className="size-4" />
                                </Button>
                            )}
                            {step === "report" && (
                                <Button
                                    size="sm"
                                    disabled={!canProceedFromReport()}
                                    onClick={() => goTo("review")}
                                >
                                    Review
                                    <ChevronRight className="size-4" />
                                </Button>
                            )}
                            {step === "review" && (
                                <Button onClick={handleSubmit} disabled={submitting}>
                                    {submitting ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Complete"
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}