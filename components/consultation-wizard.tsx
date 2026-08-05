"use client"

import { useState, useEffect } from "react"
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
import { ComplaintSelector } from "@/components/complaint-selector"

export type CompletionReport = {
    diagnosis: string
    treatment: string
    recommendations: string
}

export type DispositionStatus = "return_to_class" | "return_to_activity" | "sent_home"

type Step = "complaint" | "report" | "review"

const DISPOSITIONS: { value: DispositionStatus; label: string; description: string }[] = [
    {
        value: "return_to_class",
        label: "Return to Class",
        description: "Student left the clinic and returned to their normal class",
    },
    {
        value: "return_to_activity",
        label: "Return to Activity",
        description: "Student was released and can now return to their class activity",
    },
    {
        value: "sent_home",
        label: "Sent Home",
        description: "Student was sent home for proper guidance and rest",
    },
]

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
    onComplete: (complaint: string, report: CompletionReport, disposition: DispositionStatus) => Promise<void>
    mode?: "consultation" | "emergency"
    complaintTypes?: string[]
    onAddComplaint?: (complaint: string) => Promise<void>
}

export function ConsultationWizard({
    open,
    onOpenChange,
    patientName,
    initialComplaint,
    initialReport,
    onComplete,
    mode = "consultation",
    complaintTypes = [],
    onAddComplaint,
}: Props) {
    const [step, setStep] = useState<Step>("complaint")
    const [complaints, setComplaints] = useState<string[]>([])
    const [report, setReport] = useState<CompletionReport>(
        initialReport || { diagnosis: "", treatment: "", recommendations: "" }
    )
    const [disposition, setDisposition] = useState<DispositionStatus | null>(null)
    const [submitting, setSubmitting] = useState(false)

    // Local copy of complaint types so newly added complaints appear immediately
    const [localComplaintTypes, setLocalComplaintTypes] = useState<string[]>(complaintTypes)

    // Sync with prop changes (e.g., after parent refetches from DB)
    useEffect(() => {
        setLocalComplaintTypes(complaintTypes)
    }, [complaintTypes])

    // Reset when dialog opens with new data
    const [lastInitialComplaint, setLastInitialComplaint] = useState(initialComplaint)
    if (open && initialComplaint !== lastInitialComplaint) {
        setComplaints(initialComplaint ? initialComplaint.split("\n").filter(Boolean) : [])
        setReport(initialReport || { diagnosis: "", treatment: "", recommendations: "" })
        setStep("complaint")
        setLastInitialComplaint(initialComplaint)
    }

    const complaintText = complaints.join("\n")

    const stepIndex = STEPS.findIndex((s) => s.key === step)

    function goTo(s: Step) {
        setStep(s)
    }

    function canProceedFromComplaint(): boolean {
        return complaints.length > 0
    }

    function canProceedFromReport(): boolean {
        return report.diagnosis.trim().length > 0 &&
            report.treatment.trim().length > 0 &&
            report.recommendations.trim().length > 0
    }

    // Wrap onAddComplaint so the new complaint is added to local state immediately
    async function handleAddComplaintWrapped(complaint: string) {
        await onAddComplaint?.(complaint)
        setLocalComplaintTypes((prev) => [...prev, complaint])
    }

    async function handleSubmit() {
        if (submitting || !disposition) return
        setSubmitting(true)
        try {
            await onComplete(complaintText, report, disposition)
            setStep("complaint")
            setComplaints([])
            setReport({ diagnosis: "", treatment: "", recommendations: "" })
            setDisposition(null)
        } catch (err: any) {
            toast.error(err.message || "Failed to save")
        } finally {
            setSubmitting(false)
        }
    }

    function handleClose() {
        onOpenChange(false)
    }

    const title = mode === "consultation" ? "Consultation Report" : "Emergency Report"

    const textareaClass = "flex w-full border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
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
                                    className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border text-xs font-medium transition-colors ${isActive
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : isDone
                                            ? "border-primary/40 bg-primary-soft text-primary"
                                            : "border-border bg-background text-muted-foreground"
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
                <div className="max-h-[60vh] overflow-y-auto">
                    {step === "complaint" && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Student Complaint(s) <span className="text-destructive">*</span>
                                </label>
                                {complaintTypes.length > 0 && onAddComplaint ? (
                                    <ComplaintSelector
                                        complaints={localComplaintTypes}
                                        selected={complaints}
                                        onSelect={(c) => {
                                            setComplaints(prev => {
                                                if (prev.includes(c)) return prev.filter(x => x !== c)
                                                return [...prev, c]
                                            })
                                        }}
                                        onAddNew={handleAddComplaintWrapped}
                                    />
                                ) : (
                                    <>
                                        <textarea
                                            value={complaintText}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setComplaints(val.split("\n").filter(Boolean))
                                            }}
                                            placeholder="Enter or update the student's complaint..."
                                            required
                                            rows={4}
                                            className={textareaClass}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Enter or update the student's complaint. Use multiple lines for multiple complaints.
                                        </p>
                                    </>
                                )}
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
                                    className={textareaClass}
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
                                    className={textareaClass}
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
                                    className={textareaClass}
                                />
                            </div>
                        </div>
                    )}

                    {step === "review" && (
                        <div className="space-y-4 py-4">
                            <div className="border border-border p-3 space-y-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Student Complaint</p>
                                    <p className="text-sm font-medium">{complaints.join(", ")}</p>
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

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Disposition <span className="text-destructive">*</span>
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Select the student's status after leaving the clinic.
                                </p>
                                <div className="space-y-2">
                                    {DISPOSITIONS.map((d) => {
                                        const borderColor =
                                            d.value === "return_to_class"
                                                ? "border-success"
                                                : d.value === "return_to_activity"
                                                    ? "border-info"
                                                    : "border-warning"
                                        const selectedBg =
                                            d.value === "return_to_class"
                                                ? "bg-success/10"
                                                : d.value === "return_to_activity"
                                                    ? "bg-info/10"
                                                    : "bg-warning/10"
                                        const isSelected = disposition === d.value
                                        return (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => setDisposition(d.value)}
                                                className={`w-full text-left border p-3 transition-colors cursor-pointer ${isSelected
                                                    ? `${borderColor} ${selectedBg}`
                                                    : "border-border hover:bg-muted/50"
                                                    }`}
                                            >
                                                <p className={`text-sm font-medium ${isSelected
                                                    ? d.value === "return_to_class"
                                                        ? "text-success"
                                                        : d.value === "return_to_activity"
                                                            ? "text-info"
                                                            : "text-warning"
                                                    : ""
                                                    }`}>{d.label}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground text-center">
                                Review the details above. Click "{mode === "consultation" ? "Finish" : "Finish"}" to finalize.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="pt-4">
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
                                <Button onClick={handleSubmit} disabled={submitting || !disposition}>
                                    {submitting ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Finish"
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