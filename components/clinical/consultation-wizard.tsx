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
import { ConsultationDetailDialog } from "@/components/clinical/consultation-detail-dialog";
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
import { Select } from "@/components/ui/select";
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

// Runs the protected consultation workflow with one final database write.
export function ConsultationWizard({
  consultationId,
  open,
  onOpenChange,
  onCompleted,
}: ConsultationWizardProps) {
  const [consultation, setConsultation] =
    useState<ConsultationDetailRow | null>(null);
  const [role, setRole] = useState<"admin" | ClinicalWorkflowRole | null>(null);
  const [step, setStep] = useState<ConsultationWizardStep>("details");
  const [vitalsDisposition, setVitalsDisposition] = useState<
    "required" | "not_required" | ""
  >("");
  const [skipReason, setSkipReason] = useState("");
  const [vitals, setVitals] = useState<Vitals>(emptyVitals);
  const [notes, setNotes] = useState("");
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [diagnosisDescription, setDiagnosisDescription] = useState("");
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
      const [detail, workflowRole] = await Promise.all([
        getConsultationDetailAction(consultationId),
        getClinicalWorkflowRole(),
      ]);
      if (detail.error || !detail.consultation || !workflowRole) {
        toast.error(detail.error ?? "Consultation unavailable");
        onOpenChange(false);
        return;
      }
      setConsultation(detail.consultation);
      setRole(workflowRole);
      setNotes(detail.consultation.consultation_notes ?? "");
      setStep("details");
      setVitalsDisposition("");
      setSkipReason("");
      setVitals(emptyVitals);
      setDiagnosisCode("");
      setDiagnosisDescription("");
      setPrescription(emptyPrescription);
      setPrescriptions([]);
      setFollowUpDate("");
      setFollowUpReason("");
    }
    void loadWorkflow();
  }, [consultationId, onOpenChange, open]);

  // Loads the medicine list only for a doctor who can prescribe.
  useEffect(() => {
    if (!open || role !== "doctor") return;
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
    if (!consultation || !role || role === "admin") return;
    if (!vitalsDisposition) {
      toast.error("Choose whether vital signs are required.");
      setStep("vitals");
      return;
    }
    if (vitalsDisposition === "not_required" && !skipReason.trim()) {
      toast.error("Provide a reason when vital signs are not needed.");
      setStep("vitals");
      return;
    }
    if (
      vitalsDisposition === "required" &&
      !Object.values(vitals).some((value) => value.trim())
    ) {
      toast.error("Record at least one vital sign.");
      setStep("vitals");
      return;
    }

    setSubmitting(true);
    const result = await finalizeConsultationWorkflow({
      consultation_id: consultation.id,
      vitals_disposition: vitalsDisposition,
      vitals_skip_reason: skipReason || undefined,
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
      outcome_note: notes || undefined,
      diagnosis:
        role === "doctor" && diagnosisDescription.trim()
          ? {
              icd10_code: diagnosisCode || undefined,
              description: diagnosisDescription.trim(),
            }
          : undefined,
      prescriptions:
        role === "doctor"
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
        role === "doctor" && followUpDate
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

  if (role === "admin") {
    return (
      <ConsultationDetailDialog
        consultationId={consultationId}
        onOpenChange={onOpenChange}
        open={open}
      />
    );
  }

  if (!consultation || !role) return null;

  return (
    <>
      <ConsultationWizardShell
        onOpenChange={onOpenChange}
        onRequestClose={() => setDiscardOpen(true)}
        onStepChange={setStep}
        onSubmitReview={() => void submitReview()}
        open={open}
        patientName={consultation.patient_name ?? "Patient"}
        role={role}
        step={step}
        submitting={submitting}
      >
        <WorkflowStep
          consultation={consultation}
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
          setDiagnosisCode={setDiagnosisCode}
          setDiagnosisDescription={setDiagnosisDescription}
          setFollowUpDate={setFollowUpDate}
          setFollowUpReason={setFollowUpReason}
          setNotes={setNotes}
          setPendingPrescription={setPrescription}
          setSkipReason={setSkipReason}
          setVitals={setVitals}
          setVitalsDisposition={setVitalsDisposition}
          skipReason={skipReason}
          step={step}
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
  vitalsDisposition: "required" | "not_required" | "";
  setVitalsDisposition: (value: "required" | "not_required") => void;
  skipReason: string;
  setSkipReason: (value: string) => void;
  vitals: Vitals;
  setVitals: (value: Vitals) => void;
  notes: string;
  setNotes: (value: string) => void;
  diagnosisCode: string;
  setDiagnosisCode: (value: string) => void;
  diagnosisDescription: string;
  setDiagnosisDescription: (value: string) => void;
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
    return (
      <div className="space-y-4">
        <h3 className="font-semibold">Visit details</h3>
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <p className="text-xs text-muted-foreground">Chief complaint</p>
          <p className="mt-1 font-medium">
            {props.consultation.chief_complaint || "No complaint recorded"}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Nothing in this wizard is saved until the final review.
        </p>
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
          <div className="space-y-2">
            <Label htmlFor="vitals-reason">Reason</Label>
            <Textarea
              id="vitals-reason"
              onChange={(event) => props.setSkipReason(event.target.value)}
              placeholder="Reason vital signs are not needed"
              value={props.skipReason}
            />
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

// Renders the doctor-only diagnosis, prescription, and follow-up fields.
function ClinicalPlan(props: WorkflowStepProps) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
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
        <h4 className="font-medium">Prescription</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="medicine">Medicine</Label>
            <Select
              id="medicine"
              onChange={(event) =>
                props.setPendingPrescription({
                  ...props.pendingPrescription,
                  medicine_id: event.target.value,
                })
              }
              value={props.pendingPrescription.medicine_id}
            >
              <option value="">Choose medicine</option>
              {props.medicines.map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.generic_name}
                  {medicine.brand_name ? ` (${medicine.brand_name})` : ""}
                </option>
              ))}
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
          {props.role === "doctor"
            ? "completing the consultation"
            : "submitting them to a doctor"}
          .
        </p>
      </div>
      <div className="space-y-4 rounded-lg border border-border p-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Vitals</p>
          <p className="mt-1 font-medium">
            {props.vitalsDisposition === "required"
              ? "Will be recorded"
              : props.vitalsDisposition === "not_required"
                ? `Not needed — ${props.skipReason || "Reason required"}`
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
        {props.role === "doctor" && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Clinical plan</p>
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
