"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  getConsultationDetailAction,
  type ConsultationDetailRow,
} from "@/actions/admin/visits/overview";
import {
  finalizeConsultationWorkflow,
  getComplaintCatalog,
  getClinicalWorkflowRole,
} from "@/actions/clinical/visits";
import {
  getMedicineCatalog,
  type Medicine,
} from "@/actions/clinical/prescriptions";
import {
  ConsultationWizardShell,
  type ClinicalWorkflowRole,
  type ConsultationWizardStep,
} from "@/components/clinical/consultation-wizard-shell";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface ConsultationWizardProps {
  consultationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}

type Vitals = {
  temperature: string;
  blood_pressure: string;
  heart_rate: string;
  respiratory_rate: string;
  oxygen_saturation: string;
};

type PrescriptionDraft = {
  medicine_id: string;
  dosage: string;
  frequency: string;
  duration_days: string;
  quantity: string;
  instructions: string;
};

const emptyVitals: Vitals = {
  temperature: "",
  blood_pressure: "",
  heart_rate: "",
  respiratory_rate: "",
  oxygen_saturation: "",
};

const emptyPrescription: PrescriptionDraft = {
  medicine_id: "",
  dosage: "",
  frequency: "",
  duration_days: "",
  quantity: "",
  instructions: "",
};

const vitalsSkipReasons = [
  "Document or certificate review only",
  "Routine follow-up without reassessment",
  "Recent vital signs are already documented",
  "Patient declined vital signs",
  "Immediate referral or transfer",
] as const;

// Runs the protected consultation workflow with one final database write.
export function ConsultationWizard({
  consultationId,
  open,
  onOpenChange,
  onCompleted,
}: ConsultationWizardProps) {
  const [consultation, setConsultation] =
    useState<ConsultationDetailRow | null>(null);
  const [role, setRole] = useState<ClinicalWorkflowRole | null>(null);
  const [step, setStep] = useState<ConsultationWizardStep>("details");
  const [complaintOptions, setComplaintOptions] = useState<string[]>([]);
  const [studentComplaint, setStudentComplaint] = useState("");
  const [customComplaint, setCustomComplaint] = useState("");
  const [vitalsDisposition, setVitalsDisposition] = useState<
    "required" | "not_required" | ""
  >("");
  const [skipReasonChoice, setSkipReasonChoice] = useState("");
  const [customSkipReason, setCustomSkipReason] = useState("");
  const [vitals, setVitals] = useState<Vitals>(emptyVitals);
  const [notes, setNotes] = useState("");
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [diagnosisDescription, setDiagnosisDescription] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [treatmentInstructions, setTreatmentInstructions] = useState("");
  const [treatmentFollowUpDays, setTreatmentFollowUpDays] = useState("");
  const [prescription, setPrescription] =
    useState<PrescriptionDraft>(emptyPrescription);
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Loads only the current consultation and current operator role when opened.
  useEffect(() => {
    if (!open) return;
    async function loadWorkflow() {
      const [detail, workflowRole, complaintCatalog] = await Promise.all([
        getConsultationDetailAction(consultationId),
        getClinicalWorkflowRole(),
        getComplaintCatalog(),
      ]);
      if (detail.error || !detail.consultation || !workflowRole) {
        toast.error(detail.error ?? "Consultation unavailable");
        onOpenChange(false);
        return;
      }
      setConsultation(detail.consultation);
      setRole(workflowRole);
      setComplaintOptions(complaintCatalog.complaints);
      setStudentComplaint(detail.consultation.chief_complaint ?? "");
      setCustomComplaint("");
      setNotes(detail.consultation.consultation_notes ?? "");
      setStep("details");
      setVitalsDisposition("");
      setSkipReasonChoice("");
      setCustomSkipReason("");
      setVitals(emptyVitals);
      setDiagnosisCode("");
      setDiagnosisDescription("");
      setTreatmentPlan("");
      setTreatmentInstructions("");
      setTreatmentFollowUpDays("");
      setPrescription(emptyPrescription);
      setPrescriptions([]);
      setFollowUpDate("");
      setFollowUpReason("");
    }
    void loadWorkflow();
  }, [consultationId, onOpenChange, open]);

  // Loads the medicine list only for a doctor or Admin who can prescribe.
  useEffect(() => {
    if (!open || !role || role === "nurse") return;
    async function loadMedicines() {
      const result = await getMedicineCatalog();
      if (result.error) toast.error(result.error);
      else setMedicines(result.medicines);
    }
    void loadMedicines();
  }, [open, role]);

  const pendingPrescriptionIsValid = useMemo(
    () => Boolean(prescription.medicine_id && prescription.quantity),
    [prescription.medicine_id, prescription.quantity],
  );

  const canMakeClinicalPlan = role === "admin" || role === "doctor";
  const resolvedComplaint =
    studentComplaint === "__other__"
      ? customComplaint.trim()
      : studentComplaint.trim();
  const resolvedSkipReason =
    skipReasonChoice === "__other__"
      ? customSkipReason.trim()
      : skipReasonChoice.trim();

  // Requires a complaint selection before the clinician advances from Visit.
  function validateVisit() {
    if (!resolvedComplaint) {
      toast.error("Choose or enter the student complaint.");
      return false;
    }
    return true;
  }

  // Validates the vital-sign choice before allowing forward navigation.
  function validateVitals() {
    if (!vitalsDisposition) {
      toast.error("Choose whether vital signs are required.");
      return false;
    }
    if (vitalsDisposition === "not_required" && !resolvedSkipReason) {
      toast.error("Choose a reason when vital signs are not needed.");
      return false;
    }
    if (
      vitalsDisposition === "required" &&
      !Object.values(vitals).some((value) => value.trim())
    ) {
      toast.error("Record at least one vital sign.");
      return false;
    }
    return true;
  }

  // Allows free backward navigation and validates every completed forward step.
  function requestStep(nextStep: ConsultationWizardStep) {
    if (!role) return;
    const steps: ConsultationWizardStep[] =
      role === "nurse"
        ? ["details", "vitals", "notes", "review"]
        : ["details", "vitals", "notes", "clinical_plan", "review"];
    const currentIndex = steps.indexOf(step);
    const nextIndex = steps.indexOf(nextStep);

    if (nextIndex <= currentIndex) {
      setStep(nextStep);
      return;
    }
    if (nextIndex > steps.indexOf("details") && !validateVisit()) {
      setStep("details");
      return;
    }
    if (nextIndex > steps.indexOf("vitals") && !validateVitals()) {
      setStep("vitals");
      return;
    }
    if (nextIndex > steps.indexOf("notes") && !notes.trim()) {
      toast.error("Enter the consultation outcome before continuing.");
      setStep("notes");
      return;
    }
    setStep(nextStep);
  }

  // Queues a prescription locally so Review remains the only persistent action.
  function addPrescription() {
    if (!pendingPrescriptionIsValid) {
      toast.error(
        "Choose a medicine and quantity before adding it to the review.",
      );
      return;
    }
    setPrescriptions((current) => [...current, prescription]);
    setPrescription(emptyPrescription);
  }

  // Validates the review payload and commits it atomically through the server action.
  async function submitReview() {
    if (!consultation || !role) return;
    if (!validateVisit()) {
      setStep("details");
      return;
    }
    if (!validateVitals()) {
      setStep("vitals");
      return;
    }
    if (!notes.trim()) {
      toast.error("Enter the consultation outcome before submitting.");
      setStep("notes");
      return;
    }

    setSubmitting(true);
    const result = await finalizeConsultationWorkflow({
      consultation_id: consultation.id,
      student_complaint: resolvedComplaint,
      vitals_disposition: vitalsDisposition,
      vitals_skip_reason: resolvedSkipReason || undefined,
      vitals: {
        ...(vitals.temperature
          ? { temperature: Number(vitals.temperature) }
          : {}),
        ...(vitals.blood_pressure
          ? { blood_pressure: vitals.blood_pressure }
          : {}),
        ...(vitals.heart_rate ? { heart_rate: Number(vitals.heart_rate) } : {}),
        ...(vitals.respiratory_rate
          ? { respiratory_rate: Number(vitals.respiratory_rate) }
          : {}),
        ...(vitals.oxygen_saturation
          ? { oxygen_saturation: Number(vitals.oxygen_saturation) }
          : {}),
      },
      outcome_note: notes.trim(),
      diagnosis:
        canMakeClinicalPlan && diagnosisDescription.trim()
          ? {
              icd10_code: diagnosisCode || undefined,
              description: diagnosisDescription.trim(),
            }
          : undefined,
      treatment:
        canMakeClinicalPlan &&
        (treatmentPlan.trim() || treatmentInstructions.trim())
          ? {
              treatment_plan: treatmentPlan.trim() || undefined,
              instructions: treatmentInstructions.trim() || undefined,
              follow_up_days: treatmentFollowUpDays
                ? Number(treatmentFollowUpDays)
                : undefined,
            }
          : undefined,
      prescriptions:
        canMakeClinicalPlan
          ? prescriptions.map((item) => ({
              medicine_id: item.medicine_id,
              dosage: item.dosage || undefined,
              frequency: item.frequency || undefined,
              duration_days: item.duration_days
                ? Number(item.duration_days)
                : undefined,
              quantity: item.quantity ? Number(item.quantity) : undefined,
              instructions: item.instructions || undefined,
            }))
          : [],
      follow_up:
        canMakeClinicalPlan && followUpDate
          ? {
              scheduled_date: followUpDate,
              reason: followUpReason || undefined,
            }
          : undefined,
    });
    setSubmitting(false);
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Unable to submit the consultation");
      return;
    }
    toast.success(
      result.data.status === "completed"
        ? "Consultation completed."
        : "Consultation submitted for doctor review.",
    );
    onOpenChange(false);
    onCompleted();
  }

  if (!consultation || !role) return null;

  return (
    <>
      <ConsultationWizardShell
        onOpenChange={onOpenChange}
        onRequestClose={() => setDiscardOpen(true)}
        onStepChange={requestStep}
        onSubmitReview={() => void submitReview()}
        open={open}
        patientName={consultation.patient_name ?? "Patient"}
        role={role}
        step={step}
        submitting={submitting}
      >
        <WorkflowStep
          consultation={consultation}
          complaintOptions={complaintOptions}
          customComplaint={customComplaint}
          diagnosisCode={diagnosisCode}
          diagnosisDescription={diagnosisDescription}
          followUpDate={followUpDate}
          followUpReason={followUpReason}
          medicines={medicines}
          notes={notes}
          onAddPrescription={addPrescription}
          onRemovePrescription={(index) =>
            setPrescriptions((current) =>
              current.filter((_, itemIndex) => itemIndex !== index),
            )
          }
          pendingPrescription={prescription}
          prescriptions={prescriptions}
          role={role}
          setCustomComplaint={setCustomComplaint}
          setDiagnosisCode={setDiagnosisCode}
          setDiagnosisDescription={setDiagnosisDescription}
          setTreatmentFollowUpDays={setTreatmentFollowUpDays}
          setTreatmentInstructions={setTreatmentInstructions}
          setTreatmentPlan={setTreatmentPlan}
          setFollowUpDate={setFollowUpDate}
          setFollowUpReason={setFollowUpReason}
          setNotes={setNotes}
          setStudentComplaint={setStudentComplaint}
          setPendingPrescription={setPrescription}
          customSkipReason={customSkipReason}
          resolvedSkipReason={resolvedSkipReason}
          setCustomSkipReason={setCustomSkipReason}
          setSkipReasonChoice={setSkipReasonChoice}
          setVitals={setVitals}
          setVitalsDisposition={setVitalsDisposition}
          skipReasonChoice={skipReasonChoice}
          studentComplaint={studentComplaint}
          step={step}
          treatmentFollowUpDays={treatmentFollowUpDays}
          treatmentInstructions={treatmentInstructions}
          treatmentPlan={treatmentPlan}
          vitals={vitals}
          vitalsDisposition={vitalsDisposition}
        />
      </ConsultationWizardShell>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard consultation changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Nothing has been saved yet. Review and submit the consultation to
              persist your work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              onClick={() => setDiscardOpen(false)}
              type="button"
              variant="outline"
            >
              Keep editing
            </Button>
            <Button
              onClick={() => {
                setDiscardOpen(false);
                onOpenChange(false);
              }}
              type="button"
              variant="destructive"
            >
              Discard changes
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface WorkflowStepProps {
  consultation: ConsultationDetailRow;
  step: ConsultationWizardStep;
  role: ClinicalWorkflowRole;
  complaintOptions: string[];
  studentComplaint: string;
  setStudentComplaint: (value: string) => void;
  customComplaint: string;
  setCustomComplaint: (value: string) => void;
  vitalsDisposition: "required" | "not_required" | "";
  setVitalsDisposition: (value: "required" | "not_required") => void;
  skipReasonChoice: string;
  setSkipReasonChoice: (value: string) => void;
  customSkipReason: string;
  setCustomSkipReason: (value: string) => void;
  resolvedSkipReason: string;
  vitals: Vitals;
  setVitals: (value: Vitals) => void;
  notes: string;
  setNotes: (value: string) => void;
  diagnosisCode: string;
  setDiagnosisCode: (value: string) => void;
  diagnosisDescription: string;
  setDiagnosisDescription: (value: string) => void;
  treatmentPlan: string;
  setTreatmentPlan: (value: string) => void;
  treatmentInstructions: string;
  setTreatmentInstructions: (value: string) => void;
  treatmentFollowUpDays: string;
  setTreatmentFollowUpDays: (value: string) => void;
  medicines: Medicine[];
  pendingPrescription: PrescriptionDraft;
  setPendingPrescription: (value: PrescriptionDraft) => void;
  prescriptions: PrescriptionDraft[];
  onAddPrescription: () => void;
  onRemovePrescription: (index: number) => void;
  followUpDate: string;
  setFollowUpDate: (value: string) => void;
  followUpReason: string;
  setFollowUpReason: (value: string) => void;
}

// Renders the current client-only workflow step before the final review.
function WorkflowStep(props: WorkflowStepProps) {
  if (props.step === "details") {
    const complaintLabel =
      props.consultation.patient_type === "student"
        ? "Student complaint"
        : "Patient complaint";
    const availableComplaints = Array.from(
      new Set(
        [
          ...props.complaintOptions,
          props.studentComplaint === "__other__"
            ? ""
            : props.studentComplaint,
        ].filter(Boolean),
      ),
    );

    return (
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold">Visit details</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the concern that brought the patient to the clinic.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="student-complaint">{complaintLabel}</Label>
          <Select
            onValueChange={(value) => {
              if (value) props.setStudentComplaint(value);
            }}
            value={props.studentComplaint}
          >
            <SelectTrigger className="w-full" id="student-complaint">
              <SelectValue placeholder={`Select ${complaintLabel.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {availableComplaints.map((complaint) => (
                <SelectItem key={complaint} value={complaint}>
                  {complaint}
                </SelectItem>
              ))}
              <SelectItem value="__other__">Other complaint</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {props.studentComplaint === "__other__" && (
          <div className="space-y-2">
            <Label htmlFor="custom-student-complaint">
              Enter {complaintLabel.toLowerCase()}
            </Label>
            <Textarea
              id="custom-student-complaint"
              maxLength={1000}
              onChange={(event) =>
                props.setCustomComplaint(event.target.value)
              }
              placeholder="Describe the patient concern"
              rows={4}
              value={props.customComplaint}
            />
          </div>
        )}
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground">
            Nothing in this wizard is saved until the final review.
          </p>
        </div>
      </div>
    );
  }

  if (props.step === "vitals") {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold">Vitals</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose one option before continuing.
          </p>
        </div>
        <RadioGroup
          name="vitals-disposition"
          onValueChange={(value) =>
            props.setVitalsDisposition(value as "required" | "not_required")
          }
          value={props.vitalsDisposition}
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-field p-4 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
            <RadioGroupItem id="vitals-required" value="required" />
            <span>
              <span className="block font-medium">Record vital signs</span>
              <span className="text-sm text-muted-foreground">
                Enter at least one measurement below.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-field p-4 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
            <RadioGroupItem id="vitals-not-required" value="not_required" />
            <span>
              <span className="block font-medium">Vitals not needed</span>
              <span className="text-sm text-muted-foreground">
                Document why this assessment is not required.
              </span>
            </span>
          </label>
        </RadioGroup>
        {props.vitalsDisposition === "not_required" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vitals-reason">Reason</Label>
              <Select
                onValueChange={(value) => {
                  if (value) props.setSkipReasonChoice(value);
                }}
                value={props.skipReasonChoice}
              >
                <SelectTrigger className="w-full" id="vitals-reason">
                  <SelectValue placeholder="Select why vital signs are not needed" />
                </SelectTrigger>
                <SelectContent>
                  {vitalsSkipReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                  <SelectItem value="__other__">Other reason</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {props.skipReasonChoice === "__other__" && (
              <div className="space-y-2">
                <Label htmlFor="custom-vitals-reason">Other reason</Label>
                <Textarea
                  id="custom-vitals-reason"
                  maxLength={500}
                  onChange={(event) =>
                    props.setCustomSkipReason(event.target.value)
                  }
                  placeholder="Enter why vital signs are not needed"
                  value={props.customSkipReason}
                />
              </div>
            )}
          </div>
        )}
        {props.vitalsDisposition === "required" && (
          <VitalFields setVitals={props.setVitals} vitals={props.vitals} />
        )}
      </div>
    );
  }

  if (props.step === "notes")
    return (
      <div className="space-y-2">
        <h3 className="font-semibold">Consultation outcome</h3>
        <p className="text-sm text-muted-foreground">
          This note is included in Review and saved only when submitted.
        </p>
        <Textarea
          onChange={(event) => props.setNotes(event.target.value)}
          placeholder="Assessment, care provided, and outcome"
          rows={10}
          value={props.notes}
        />
      </div>
    );

  if (props.step === "clinical_plan") return <ClinicalPlan {...props} />;

  return <ReviewStep {...props} />;
}

// Renders the Doctor and Admin diagnosis, treatment, prescription, and follow-up fields.
function ClinicalPlan(props: WorkflowStepProps) {
  const [tomorrow] = useState(() => {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toISOString().slice(0, 10);
  });
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">Clinical plan</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional clinical decisions are committed only from Review.
        </p>
      </div>
      <Separator />
      <section className="space-y-3">
        <h4 className="font-medium">Diagnosis</h4>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div className="space-y-1">
            <Label htmlFor="icd10">ICD-10 code</Label>
            <Input
              id="icd10"
              onChange={(event) => props.setDiagnosisCode(event.target.value)}
              value={props.diagnosisCode}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="diagnosis">Description</Label>
            <Input
              id="diagnosis"
              onChange={(event) =>
                props.setDiagnosisDescription(event.target.value)
              }
              placeholder="Clinical diagnosis"
              value={props.diagnosisDescription}
            />
          </div>
        </div>
      </section>
      <Separator />
      <section className="space-y-3">
        <h4 className="font-medium">Treatment</h4>
        <div className="space-y-2">
          <Label htmlFor="treatment-plan">Treatment plan</Label>
          <Textarea
            id="treatment-plan"
            onChange={(event) => props.setTreatmentPlan(event.target.value)}
            placeholder="Care plan and treatment decisions"
            value={props.treatmentPlan}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="space-y-2">
            <Label htmlFor="treatment-instructions">
              Patient instructions
            </Label>
            <Textarea
              id="treatment-instructions"
              onChange={(event) =>
                props.setTreatmentInstructions(event.target.value)
              }
              placeholder="Home care and safety instructions"
              value={props.treatmentInstructions}
            />
          </div>
          <VitalInput
            label="Follow-up days"
            min={1}
            onChange={props.setTreatmentFollowUpDays}
            type="number"
            value={props.treatmentFollowUpDays}
          />
        </div>
      </section>
      <Separator />
      <section className="space-y-3">
        <h4 className="font-medium">Prescription</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="medicine">Medicine</Label>
            <Select
              onValueChange={(medicineId) =>
                props.setPendingPrescription({
                  ...props.pendingPrescription,
                  medicine_id: medicineId ?? "",
                })
              }
              value={props.pendingPrescription.medicine_id || null}
            >
              <SelectTrigger className="w-full" id="medicine">
                <SelectValue placeholder="Choose medicine" />
              </SelectTrigger>
              <SelectContent>
                {props.medicines.map((medicine) => (
                  <SelectItem key={medicine.id} value={medicine.id}>
                    {medicine.generic_name}
                    {medicine.brand_name ? ` (${medicine.brand_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <VitalInput
            label="Quantity"
            onChange={(quantity) =>
              props.setPendingPrescription({
                ...props.pendingPrescription,
                quantity,
              })
            }
            value={props.pendingPrescription.quantity}
          />
          <VitalInput
            label="Dosage"
            onChange={(dosage) =>
              props.setPendingPrescription({
                ...props.pendingPrescription,
                dosage,
              })
            }
            value={props.pendingPrescription.dosage}
          />
          <VitalInput
            label="Frequency"
            onChange={(frequency) =>
              props.setPendingPrescription({
                ...props.pendingPrescription,
                frequency,
              })
            }
            value={props.pendingPrescription.frequency}
          />
        </div>
        <Button
          onClick={props.onAddPrescription}
          type="button"
          variant="outline"
        >
          <Plus className="size-4" />
          Add prescription to review
        </Button>
        {props.prescriptions.length > 0 && (
          <div className="divide-y rounded-lg border border-border">
            {props.prescriptions.map((item, index) => (
              <div
                className="flex items-center justify-between gap-3 p-3 text-sm"
                key={`${item.medicine_id}-${index}`}
              >
                <span>
                  {props.medicines.find(
                    (medicine) => medicine.id === item.medicine_id,
                  )?.generic_name ?? "Medicine"}{" "}
                  · {item.quantity}
                </span>
                <Button
                  aria-label="Remove prescription"
                  onClick={() => props.onRemovePrescription(index)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <Separator />
      <section className="space-y-3">
        <h4 className="font-medium">Follow-up</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="follow-up-date">Date</Label>
            <Input
              id="follow-up-date"
              min={tomorrow}
              onChange={(event) => props.setFollowUpDate(event.target.value)}
              type="date"
              value={props.followUpDate}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="follow-up-reason">Reason</Label>
            <Input
              id="follow-up-reason"
              onChange={(event) => props.setFollowUpReason(event.target.value)}
              value={props.followUpReason}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// Summarizes all client-only data immediately before the one final write.
function ReviewStep(props: WorkflowStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Review consultation</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm these details before{" "}
          {props.role === "nurse"
            ? "submitting them to a doctor"
            : "completing the consultation"}
          .
        </p>
      </div>
      <div className="space-y-4 rounded-lg border border-border p-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">
            {props.consultation.patient_type === "student"
              ? "Student complaint"
              : "Patient complaint"}
          </p>
          <p className="mt-1 font-medium">
            {props.studentComplaint === "__other__"
              ? props.customComplaint || "No complaint entered"
              : props.studentComplaint || "No complaint selected"}
          </p>
        </div>
        <Separator />
        <div>
          <p className="text-xs text-muted-foreground">Vitals</p>
          <p className="mt-1 font-medium">
            {props.vitalsDisposition === "required"
              ? "Will be recorded"
              : props.vitalsDisposition === "not_required"
                ? `Not needed — ${props.resolvedSkipReason || "Reason required"}`
                : "Not selected"}
          </p>
        </div>
        <Separator />
        <div>
          <p className="text-xs text-muted-foreground">Outcome note</p>
          <p className="mt-1 whitespace-pre-wrap">
            {props.notes || "No outcome note"}
          </p>
        </div>
        {props.role !== "nurse" && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Clinical plan</p>
              <p className="mt-1">
                {props.treatmentPlan || props.treatmentInstructions
                  ? "Treatment recorded"
                  : "No treatment recorded"}
              </p>
              <p className="mt-1">
                {props.diagnosisDescription || "No diagnosis"} ·{" "}
                {props.prescriptions.length} prescription(s)
                {props.followUpDate ? ` · Follow-up ${props.followUpDate}` : ""}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Renders the recordable vital-sign fields.
function VitalFields({
  vitals,
  setVitals,
}: {
  vitals: Vitals;
  setVitals: (value: Vitals) => void;
}) {
  const update = (key: keyof Vitals, value: string) =>
    setVitals({ ...vitals, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <VitalInput
        label="Temperature (°C)"
        onChange={(value) => update("temperature", value)}
        type="number"
        value={vitals.temperature}
      />
      <VitalInput
        label="Blood pressure"
        onChange={(value) => update("blood_pressure", value)}
        placeholder="120/80"
        value={vitals.blood_pressure}
      />
      <VitalInput
        label="Heart rate (bpm)"
        onChange={(value) => update("heart_rate", value)}
        type="number"
        value={vitals.heart_rate}
      />
      <VitalInput
        label="Respiratory rate (/min)"
        onChange={(value) => update("respiratory_rate", value)}
        type="number"
        value={vitals.respiratory_rate}
      />
      <VitalInput
        label="Oxygen saturation (%)"
        onChange={(value) => update("oxygen_saturation", value)}
        type="number"
        value={vitals.oxygen_saturation}
      />
    </div>
  );
}

// Renders one labelled field used by vitals and prescription details.
function VitalInput({
  label,
  onChange,
  value,
  ...props
}: { label: string; onChange: (value: string) => void; value: string } & Omit<
  ComponentProps<typeof Input>,
  "onChange" | "value"
>) {
  const id = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
        {...props}
      />
    </div>
  );
}
