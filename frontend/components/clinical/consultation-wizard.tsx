"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Clock3, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  getConsultationDetailAction,
  type ConsultationDetailRow,
} from "@/actions/clinical/visits/queries";
import {
  claimConsultationAction,
  finalizeConsultationWorkflowAction,
  getAvailableReviewDoctorsAction,
  getClinicalWorkflowRoleAction,
  getVisitReasonCatalogAction,
  type AvailableReviewDoctor,
} from "@/actions/clinical/visits/workflow";
import {
  getMedicineCatalogAction,
  type Medicine,
} from "@/actions/clinical/prescriptions/management";
import {
  deletePrescriptionFavoriteAction,
  getPrescriptionFavoritesAction,
  savePrescriptionFavoriteAction,
  type PrescriptionFavorite,
} from "@/actions/clinical/prescriptions/favorites";
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
import { SearchableCombobox } from "@/components/ui/combobox";
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
  const router = useRouter();
  const [closed, setClosed] = useState(false);
  const [consultation, setConsultation] =
    useState<ConsultationDetailRow | null>(null);
  const [role, setRole] = useState<ClinicalWorkflowRole | null>(null);
  const [step, setStep] = useState<ConsultationWizardStep>("details");
  const [visitReasonOptions, setVisitReasonOptions] = useState<string[]>([]);
  const [patientComplaint, setPatientComplaint] = useState("");
  const [customPatientComplaint, setCustomPatientComplaint] = useState("");
  const [vitalsDisposition, setVitalsDispositionAction] = useState<
    "required" | "not_required" | "existing" | ""
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
  const [availableDoctors, setAvailableDoctors] = useState<
    AvailableReviewDoctor[]
  >([]);
  const [selectedReviewDoctorId, setSelectedReviewDoctorId] =
    useState<string>("__pending__");
  const [favorites, setFavorites] = useState<PrescriptionFavorite[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Loads only the current consultation and current operator role when opened.
  useEffect(() => {
    if (!open) return;
    setClosed(false);
    async function loadWorkflow() {
      const [detail, workflowRole, visitReasonCatalog] = await Promise.all([
        getConsultationDetailAction(consultationId),
        getClinicalWorkflowRoleAction(),
        getVisitReasonCatalogAction(),
      ]);
      if (detail.error || !detail.consultation || !workflowRole) {
        toast.error(detail.error ?? "Consultation unavailable");
        setClosed(true);
        onOpenChange(false);
        return;
      }
      if (detail.consultation.status === "completed") {
        toast.info("This consultation has already been completed.");
        setClosed(true);
        onOpenChange(false);
        onCompleted();
        return;
      }
      void claimConsultationAction({ consultation_id: consultationId });
      setConsultation(detail.consultation);
      setRole(workflowRole);
      router.prefetch(`/${workflowRole}/visits/history`);
      const isHandoffReview = Boolean(
        workflowRole === "doctor" && detail.consultation.nurse_handoff_at,
      );
      if (visitReasonCatalog.error) toast.error(visitReasonCatalog.error);
      setVisitReasonOptions(visitReasonCatalog.reasons);
      setPatientComplaint(detail.consultation.patient_complaint ?? "");
      setCustomPatientComplaint("");
      setNotes(isHandoffReview ? "" : detail.consultation.consultation_notes ?? "");
      setStep(isHandoffReview ? "handoff" : "details");
      setVitalsDispositionAction(isHandoffReview ? "existing" : "");
      setSkipReasonChoice("");
      setCustomSkipReason("");
      setVitals({
        temperature: detail.consultation.triage?.temperature?.toString() ?? "",
        blood_pressure: detail.consultation.triage?.blood_pressure ?? "",
        heart_rate: detail.consultation.triage?.heart_rate?.toString() ?? "",
        respiratory_rate:
          detail.consultation.triage?.respiratory_rate?.toString() ?? "",
        oxygen_saturation:
          detail.consultation.triage?.oxygen_saturation?.toString() ?? "",
      });
      setDiagnosisCode("");
      setDiagnosisDescription("");
      setTreatmentPlan("");
      setTreatmentInstructions("");
      setTreatmentFollowUpDays("");
      setPrescription(emptyPrescription);
      setPrescriptions([]);
      setFollowUpDate("");
      setFollowUpReason("");
      setSelectedReviewDoctorId("__pending__");
      if (workflowRole === "nurse") {
        const doctorResult = await getAvailableReviewDoctorsAction();
        if (doctorResult.error) toast.error(doctorResult.error);
        setAvailableDoctors(doctorResult.doctors);
      } else {
        setAvailableDoctors([]);
      }
    }
    void loadWorkflow();
  }, [consultationId, onOpenChange, open]);

  // Loads the medicine list only for a doctor or Admin who can prescribe.
  useEffect(() => {
    if (!open || !role || role === "nurse") return;
    async function loadMedicines() {
      const [result, favoriteResult] = await Promise.all([
        getMedicineCatalogAction(),
        role === "doctor"
          ? getPrescriptionFavoritesAction()
          : Promise.resolve({ error: null, favorites: [] }),
      ]);
      if (result.error) toast.error(result.error);
      else setMedicines(result.medicines);
      if (favoriteResult.error) toast.error(favoriteResult.error);
      else setFavorites(favoriteResult.favorites);
    }
    void loadMedicines();
  }, [open, role]);

  const pendingPrescriptionIsValid = useMemo(
    () => Boolean(prescription.medicine_id && prescription.quantity),
    [prescription.medicine_id, prescription.quantity],
  );

  const canMakeClinicalPlan = role === "admin" || role === "doctor";
  const isNurseHandoffReview = Boolean(
    role === "doctor" && consultation?.nurse_handoff_at,
  );
  const resolvedPatientComplaint =
    patientComplaint === "__other__"
      ? customPatientComplaint.trim()
      : patientComplaint.trim();
  const resolvedSkipReason =
    skipReasonChoice === "__other__"
      ? customSkipReason.trim()
      : skipReasonChoice.trim();

  // Requires a complaint selection before the clinician advances from Visit.
  function validateVisit() {
    if (isNurseHandoffReview) return true;
    if (!resolvedPatientComplaint) {
      toast.error("Choose or enter the visit reason.");
      return false;
    }
    return true;
  }

  // Validates the vital-sign choice before allowing forward navigation.
  function validateVitals() {
    if (isNurseHandoffReview) return true;
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
        ? ["details", "vitals", "notes", "doctor_selection", "review"]
        : isNurseHandoffReview
          ? ["handoff", "clinical_plan", "review"]
          : ["details", "vitals", "notes", "clinical_plan", "review"];
    const currentIndex = steps.indexOf(step);
    const nextIndex = steps.indexOf(nextStep);

    if (nextIndex <= currentIndex) {
      setStep(nextStep);
      return;
    }
    if (
      steps.includes("details") &&
      nextIndex > steps.indexOf("details") &&
      !validateVisit()
    ) {
      setStep("details");
      return;
    }
    if (
      steps.includes("vitals") &&
      nextIndex > steps.indexOf("vitals") &&
      !validateVitals()
    ) {
      setStep("vitals");
      return;
    }
    if (
      steps.includes("notes") &&
      nextIndex > steps.indexOf("notes") &&
      !notes.trim()
    ) {
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
    if (!isNurseHandoffReview && !validateVisit()) {
      setStep("details");
      return;
    }
    if (!isNurseHandoffReview && !validateVitals()) {
      setStep("vitals");
      return;
    }
    if (!notes.trim()) {
      toast.error("Enter the consultation outcome before submitting.");
      setStep(isNurseHandoffReview ? "clinical_plan" : "notes");
      return;
    }

    setSubmitting(true);
    const result = await finalizeConsultationWorkflowAction({
      consultation_id: consultation.id,
      patient_complaint: resolvedPatientComplaint,
      review_doctor_id:
        role === "nurse" && selectedReviewDoctorId !== "__pending__"
          ? selectedReviewDoctorId
          : null,
      vitals_disposition: isNurseHandoffReview
        ? "existing"
        : vitalsDisposition,
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
    setClosed(true);
    onOpenChange(false);
    onCompleted();
    if (result.data.status === "completed") {
      router.push(`/${role}/visits/history`);
    }
  }

  if (closed || !consultation || !role) return null;

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
        isNurseHandoffReview={isNurseHandoffReview}
        step={step}
        submitting={submitting}
      >
        <WorkflowStep
          consultation={consultation}
          customPatientComplaint={customPatientComplaint}
          diagnosisCode={diagnosisCode}
          diagnosisDescription={diagnosisDescription}
          followUpDate={followUpDate}
          followUpReason={followUpReason}
          medicines={medicines}
          availableDoctors={availableDoctors}
          favorites={favorites}
          isNurseHandoffReview={isNurseHandoffReview}
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
          setCustomPatientComplaint={setCustomPatientComplaint}
          setDiagnosisCode={setDiagnosisCode}
          setDiagnosisDescription={setDiagnosisDescription}
          setTreatmentFollowUpDays={setTreatmentFollowUpDays}
          setTreatmentInstructions={setTreatmentInstructions}
          setTreatmentPlan={setTreatmentPlan}
          setFollowUpDate={setFollowUpDate}
          setFollowUpReason={setFollowUpReason}
          setNotes={setNotes}
          setPatientComplaint={setPatientComplaint}
          setPendingPrescription={setPrescription}
          selectedReviewDoctorId={selectedReviewDoctorId}
          setSelectedReviewDoctorId={setSelectedReviewDoctorId}
          setFavorites={setFavorites}
          customSkipReason={customSkipReason}
          resolvedSkipReason={resolvedSkipReason}
          setCustomSkipReason={setCustomSkipReason}
          setSkipReasonChoice={setSkipReasonChoice}
          setVitals={setVitals}
          setVitalsDispositionAction={setVitalsDispositionAction}
          skipReasonChoice={skipReasonChoice}
          patientComplaint={patientComplaint}
          step={step}
          treatmentFollowUpDays={treatmentFollowUpDays}
          treatmentInstructions={treatmentInstructions}
          treatmentPlan={treatmentPlan}
          vitals={vitals}
          vitalsDisposition={vitalsDisposition}
          visitReasonOptions={visitReasonOptions}
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
  visitReasonOptions: string[];
  patientComplaint: string;
  setPatientComplaint: (value: string) => void;
  customPatientComplaint: string;
  setCustomPatientComplaint: (value: string) => void;
  vitalsDisposition: "required" | "not_required" | "existing" | "";
  setVitalsDispositionAction: (
    value: "required" | "not_required" | "existing",
  ) => void;
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
  availableDoctors: AvailableReviewDoctor[];
  selectedReviewDoctorId: string;
  setSelectedReviewDoctorId: (value: string) => void;
  favorites: PrescriptionFavorite[];
  setFavorites: (value: PrescriptionFavorite[]) => void;
  isNurseHandoffReview: boolean;
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
  if (props.step === "handoff") {
    return <NurseHandoffSummary {...props} />;
  }

  if (props.step === "details") {
    const availableReasons = Array.from(
      new Set(
        [
          ...props.visitReasonOptions,
          props.patientComplaint === "__other__"
            ? ""
            : props.patientComplaint,
        ].filter(Boolean),
      ),
    );
    const reasonOptions = [
      ...availableReasons.map((reason) => ({ label: reason, value: reason })),
      { label: "Other", value: "__other__" },
    ];

    return (
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold">Visit details</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the reason that brought the patient to the clinic.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Visit reason</Label>
          <SearchableCombobox
            ariaLabel="Visit reason"
            emptyText="No visit reasons match your search. Choose Other to enter one."
            onValueChange={props.setPatientComplaint}
            options={reasonOptions}
            placeholder="Select a visit reason"
            searchPlaceholder="Search visit reasons"
            value={props.patientComplaint}
          />
        </div>
        {props.patientComplaint === "__other__" && (
          <div className="space-y-2">
            <Label htmlFor="custom-patient-complaint">
              Other visit reason
            </Label>
            <Input
              id="custom-patient-complaint"
              maxLength={120}
              onChange={(event) =>
                props.setCustomPatientComplaint(event.target.value)
              }
              placeholder="Enter a concise reason"
              value={props.customPatientComplaint}
            />
            <p className="text-xs text-muted-foreground">
              Use a short clinical category. Do not include names or other
              identifying details.
            </p>
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
            props.setVitalsDispositionAction(value as "required" | "not_required")
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

  if (props.step === "doctor_selection") {
    return <DoctorSelectionStep {...props} />;
  }

  return <ReviewStep {...props} />;
}

// Shows Nurse-entered clinical information without allowing Doctor edits.
function NurseHandoffSummary(props: WorkflowStepProps) {
  const triage = props.consultation.triage;
  const vitals = [
    ["Temperature", triage?.temperature ? `${triage.temperature} °C` : null],
    ["Blood pressure", triage?.blood_pressure],
    ["Heart rate", triage?.heart_rate ? `${triage.heart_rate} bpm` : null],
    [
      "Respiratory rate",
      triage?.respiratory_rate ? `${triage.respiratory_rate}/min` : null,
    ],
    [
      "Oxygen saturation",
      triage?.oxygen_saturation ? `${triage.oxygen_saturation}%` : null,
    ],
  ].filter((item) => item[1]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Nurse handoff</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This assessment is read-only. Add your own clinical review in the next
          step.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Visit reason
          </p>
          <p className="mt-2 font-medium">
            {props.consultation.patient_complaint ?? "Not recorded"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Submitted by
          </p>
          <p className="mt-2 font-medium">
            {props.consultation.nurse_name ?? "Nurse"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {props.consultation.nurse_handoff_at
              ? new Date(props.consultation.nurse_handoff_at).toLocaleString()
              : "Time not recorded"}
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nurse handoff note
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
          {props.consultation.nurse_handoff_note ?? "No handoff note recorded"}
        </p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vital signs and triage
        </p>
        {vitals.length > 0 ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vitals.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm">
            Vitals not required — {props.consultation.vitals_skip_reason ?? "reason not recorded"}
          </p>
        )}
      </div>
    </div>
  );
}

// Lets the Nurse select an available Doctor or preserve pending assignment.
function DoctorSelectionStep(props: WorkflowStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Choose a reviewing Doctor</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Availability combines the Doctor&apos;s schedule, active blocks, and
          expiring on-duty status.
        </p>
      </div>
      <RadioGroup
        onValueChange={props.setSelectedReviewDoctorId}
        value={props.selectedReviewDoctorId}
      >
        {props.availableDoctors.map((doctor) => (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20"
            key={doctor.clinicAccountId}
          >
            <RadioGroupItem value={doctor.clinicAccountId} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{doctor.displayName}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-3.5" />
                Available until {new Date(doctor.availableUntil).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <span>· {doctor.activeReviewCount} active reviews</span>
              </span>
            </span>
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
          <RadioGroupItem value="__pending__" />
          <span>
            <span className="block font-medium">Pending assignment</span>
            <span className="text-sm text-muted-foreground">
              Save safely for the first eligible on-duty Doctor to claim.
            </span>
          </span>
        </label>
      </RadioGroup>
    </div>
  );
}

// Renders the Doctor and Admin diagnosis, treatment, prescription, and follow-up fields.
function ClinicalPlan(props: WorkflowStepProps) {
  const [favoriteLabel, setFavoriteLabel] = useState("");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState("");
  const [tomorrow] = useState(() => {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toISOString().slice(0, 10);
  });

  // Applies a Doctor-owned favorite while keeping every field editable.
  function applyFavorite(favoriteId: string) {
    setSelectedFavoriteId(favoriteId);
    const favorite = props.favorites.find((item) => item.id === favoriteId);
    if (!favorite) return;
    props.setPendingPrescription({
      medicine_id: favorite.medicineId,
      dosage: favorite.dosage ?? "",
      frequency: favorite.frequency ?? "",
      duration_days: favorite.durationDays?.toString() ?? "",
      quantity: favorite.quantity?.toString() ?? "",
      instructions: favorite.instructions ?? "",
    });
  }

  // Saves the current editable prescription values as a Doctor favorite.
  async function saveFavorite() {
    if (!favoriteLabel.trim() || !props.pendingPrescription.medicine_id) {
      toast.error("Choose a medicine and enter a favorite label.");
      return;
    }
    const result = await savePrescriptionFavoriteAction({
      medicineId: props.pendingPrescription.medicine_id,
      label: favoriteLabel,
      dosage: props.pendingPrescription.dosage || undefined,
      frequency: props.pendingPrescription.frequency || undefined,
      durationDays: props.pendingPrescription.duration_days
        ? Number(props.pendingPrescription.duration_days)
        : undefined,
      quantity: props.pendingPrescription.quantity
        ? Number(props.pendingPrescription.quantity)
        : undefined,
      instructions: props.pendingPrescription.instructions || undefined,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const refreshed = await getPrescriptionFavoritesAction();
    if (!refreshed.error) props.setFavorites(refreshed.favorites);
    setFavoriteLabel("");
    toast.success("Prescription favorite saved.");
  }

  // Removes the selected Doctor favorite without changing the draft.
  async function deleteFavorite() {
    if (!selectedFavoriteId) return;
    const result = await deletePrescriptionFavoriteAction(selectedFavoriteId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    props.setFavorites(
      props.favorites.filter((item) => item.id !== selectedFavoriteId),
    );
    setSelectedFavoriteId("");
    toast.success("Prescription favorite removed.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">Clinical plan</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional clinical decisions are committed only from Review.
        </p>
      </div>
      {props.isNurseHandoffReview && (
        <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
          <Label htmlFor="doctor-review-note">Doctor review note</Label>
          <Textarea
            id="doctor-review-note"
            maxLength={5000}
            onChange={(event) => props.setNotes(event.target.value)}
            placeholder="Your assessment and review of the Nurse handoff"
            rows={5}
            value={props.notes}
          />
          <p className="text-xs text-muted-foreground">
            The Nurse handoff remains unchanged and is stored separately.
          </p>
        </section>
      )}
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
        {props.role === "doctor" && props.favorites.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <Label>Prescription favorite</Label>
                <SearchableCombobox
                  ariaLabel="Prescription favorite"
                  emptyText="No favorite matches your search."
                  onValueChange={applyFavorite}
                  options={props.favorites.map((favorite) => ({
                    label: favorite.label,
                    value: favorite.id,
                  }))}
                  placeholder="Apply a saved favorite"
                  searchPlaceholder="Search favorites"
                  value={selectedFavoriteId}
                />
              </div>
              <Button
                disabled={!selectedFavoriteId}
                onClick={() => void deleteFavorite()}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                Delete favorite
              </Button>
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Medicine</Label>
            <SearchableCombobox
              ariaLabel="Medicine"
              emptyText="No approved medicine matches your search."
              onValueChange={(medicineId) =>
                props.setPendingPrescription({
                  ...props.pendingPrescription,
                  medicine_id: medicineId,
                })
              }
              options={props.medicines.map((medicine) => ({
                label: `${medicine.generic_name}${medicine.brand_name ? ` (${medicine.brand_name})` : ""
                  } — ${medicine.available_stock} ${medicine.unit} available`,
                value: medicine.id,
              }))}
              placeholder="Search approved medicines"
              searchPlaceholder="Search medicine or brand"
              value={props.pendingPrescription.medicine_id}
            />
            {props.pendingPrescription.medicine_id && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const selected = props.medicines.find(
                    (medicine) =>
                      medicine.id === props.pendingPrescription.medicine_id,
                  );
                  if (!selected) return "Medicine unavailable";
                  if (selected.available_stock <= 0) return "Out of stock";
                  if (selected.available_stock <= selected.min_stock_level) {
                    return `Low stock: ${selected.available_stock} ${selected.unit}`;
                  }
                  return `Available stock: ${selected.available_stock} ${selected.unit}`;
                })()}
              </p>
            )}
          </div>
          <VitalInput
            label="Quantity"
            min={1}
            onChange={(quantity) =>
              props.setPendingPrescription({
                ...props.pendingPrescription,
                quantity,
              })
            }
            type="number"
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
          <div className="space-y-2 sm:col-span-2">
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
            <div className="flex flex-wrap gap-2" aria-label="Frequency quick picks">
              {["Once daily", "Twice daily", "Three times daily", "As needed"].map(
                (frequency) => (
                  <Button
                    key={frequency}
                    onClick={() =>
                      props.setPendingPrescription({
                        ...props.pendingPrescription,
                        frequency,
                      })
                    }
                    size="sm"
                    type="button"
                    variant={
                      props.pendingPrescription.frequency === frequency
                        ? "default"
                        : "outline"
                    }
                  >
                    {frequency}
                  </Button>
                ),
              )}
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <VitalInput
              label="Duration in days"
              min={1}
              onChange={(durationDays) =>
                props.setPendingPrescription({
                  ...props.pendingPrescription,
                  duration_days: durationDays,
                })
              }
              type="number"
              value={props.pendingPrescription.duration_days}
            />
            <div className="flex flex-wrap gap-2" aria-label="Duration quick picks">
              {[3, 5, 7, 14, 30].map((days) => (
                <Button
                  key={days}
                  onClick={() =>
                    props.setPendingPrescription({
                      ...props.pendingPrescription,
                      duration_days: String(days),
                    })
                  }
                  size="sm"
                  type="button"
                  variant={
                    props.pendingPrescription.duration_days === String(days)
                      ? "default"
                      : "outline"
                  }
                >
                  {days} days
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="prescription-instructions">Instructions</Label>
            <Textarea
              id="prescription-instructions"
              maxLength={1000}
              onChange={(event) =>
                props.setPendingPrescription({
                  ...props.pendingPrescription,
                  instructions: event.target.value,
                })
              }
              placeholder="Optional patient instructions"
              value={props.pendingPrescription.instructions}
            />
          </div>
        </div>
        {props.role === "doctor" && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="favorite-label">Favorite label</Label>
              <Input
                id="favorite-label"
                maxLength={80}
                onChange={(event) => setFavoriteLabel(event.target.value)}
                placeholder="Example: Standard fever care"
                value={favoriteLabel}
              />
            </div>
            <Button
              disabled={
                !favoriteLabel.trim() ||
                !props.pendingPrescription.medicine_id
              }
              onClick={() => void saveFavorite()}
              type="button"
              variant="outline"
            >
              <Star className="size-4" />
              Save as favorite
            </Button>
          </div>
        )}
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
            Visit reason
          </p>
          <p className="mt-1 font-medium">
            {props.patientComplaint === "__other__"
              ? props.customPatientComplaint || "No visit reason entered"
              : props.patientComplaint || "No visit reason selected"}
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
                : props.vitalsDisposition === "existing"
                  ? "Using the Nurse assessment shown in the handoff"
                  : "Not selected"}
          </p>
        </div>
        <Separator />
        <div>
          <p className="text-xs text-muted-foreground">
            {props.isNurseHandoffReview ? "Doctor review note" : "Outcome note"}
          </p>
          <p className="mt-1 whitespace-pre-wrap">
            {props.notes || "No outcome note"}
          </p>
        </div>
        {props.role === "nurse" && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Review assignment</p>
              <p className="mt-1 font-medium">
                {props.selectedReviewDoctorId === "__pending__"
                  ? "Pending assignment"
                  : props.availableDoctors.find(
                    (doctor) =>
                      doctor.clinicAccountId === props.selectedReviewDoctorId,
                  )?.displayName ?? "Selected Doctor"}
              </p>
            </div>
          </>
        )}
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
