"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getConsultationDetailAction,
  updateConsultationNotesAction,
  type ConsultationDetailRow,
} from "@/actions/admin/visits-admin";
import {
  claimConsultation,
  completeClinicalConsultation,
  createTriageAssessment,
  setVitalsDisposition,
} from "@/actions/clinical/visits";
import {
  clearConsultationDraft,
  getConsultationDraft,
  saveConsultationWizardState,
} from "@/actions/clinical/consultation-drafts";
import {
  ConsultationWizardShell,
  type ConsultationWizardStep,
} from "@/components/clinical/consultation-wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConsultationWizardProps {
  consultationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}

// Runs the protected consultation workflow inside a resumable modal wizard.
export function ConsultationWizard({
  consultationId,
  open,
  onOpenChange,
  onCompleted,
}: ConsultationWizardProps) {
  const [consultation, setConsultation] =
    useState<ConsultationDetailRow | null>(null);
  const [step, setStep] = useState<ConsultationWizardStep>("details");
  const [notes, setNotes] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [vitals, setVitals] = useState({
    temperature: "",
    blood_pressure: "",
    heart_rate: "",
    respiratory_rate: "",
    oxygen_saturation: "",
  });
  const [saving, setSaving] = useState(false);

  // Loads, claims, and restores one consultation when the wizard opens.
  useEffect(() => {
    if (!open) return;
    async function load() {
      const detail = await getConsultationDetailAction(consultationId);
      if (!detail.consultation)
        return toast.error(detail.error ?? "Consultation unavailable");
      if (detail.consultation.status === "queued") {
        const claim = await claimConsultation({
          consultation_id: consultationId,
        });
        if (!claim.success)
          return toast.error(claim.error ?? "Consultation unavailable");
      }
      const [latest, draft] = await Promise.all([
        getConsultationDetailAction(consultationId),
        getConsultationDraft(consultationId),
      ]);
      if (!latest.consultation) return;
      setConsultation(latest.consultation);
      setNotes(
        typeof draft.draft?.draft_data.outcomeNote === "string"
          ? draft.draft.draft_data.outcomeNote
          : (latest.consultation.consultation_notes ?? ""),
      );
      setSkipReason(
        typeof draft.draft?.draft_data.vitalsSkipReason === "string"
          ? draft.draft.draft_data.vitalsSkipReason
          : (latest.consultation.vitals_skip_reason ?? ""),
      );
      setStep(draft.draft?.current_step ?? "details");
    }
    void load();
  }, [consultationId, open]);

  // Persists the current wizard state before navigation or exit.
  async function persist(nextStep = step) {
    await saveConsultationWizardState(consultationId, nextStep, {
      outcomeNote: notes,
      vitalsSkipReason: skipReason,
      vitals,
    });
  }

  // Changes steps only after preserving the current draft.
  async function changeStep(nextStep: ConsultationWizardStep) {
    await persist(nextStep);
    setStep(nextStep);
  }

  // Saves notes through the established clinical action.
  async function saveNotes() {
    const result = await updateConsultationNotesAction(consultationId, notes);
    if (result.error) return toast.error(result.error);
    toast.success("Outcome note saved");
  }

  // Saves the selected vitals decision or recorded measurements.
  async function saveVitals(required: boolean) {
    setSaving(true);
    const decision = await setVitalsDisposition({
      consultation_id: consultationId,
      disposition: required ? "required" : "not_required",
      skip_reason: required ? undefined : skipReason,
    });
    if (!decision.success) {
      setSaving(false);
      return toast.error(decision.error ?? "Unable to save vitals decision");
    }
    if (required) {
      const result = await createTriageAssessment({
        consultation_id: consultationId,
        temperature: vitals.temperature
          ? Number(vitals.temperature)
          : undefined,
        blood_pressure: vitals.blood_pressure || undefined,
        heart_rate: vitals.heart_rate ? Number(vitals.heart_rate) : undefined,
        respiratory_rate: vitals.respiratory_rate
          ? Number(vitals.respiratory_rate)
          : undefined,
        oxygen_saturation: vitals.oxygen_saturation
          ? Number(vitals.oxygen_saturation)
          : undefined,
      });
      if (!result.success)
        toast.error(result.error ?? "Unable to save vital signs");
    }
    setSaving(false);
  }

  // Completes the consultation after the server validates its clinical requirements.
  async function complete() {
    await saveNotes();
    const result = await completeClinicalConsultation({
      consultation_id: consultationId,
    });
    if (!result.success)
      return toast.error(result.error ?? "Complete the required fields first");
    await clearConsultationDraft(consultationId);
    onOpenChange(false);
    onCompleted();
  }

  if (!consultation) return null;
  return (
    <ConsultationWizardShell
      open={open}
      patientName={consultation.patient_name ?? "Patient"}
      step={step}
      onStepChange={changeStep}
      onOpenChange={onOpenChange}
      onSaveAndExit={() => {
        void persist();
        onOpenChange(false);
      }}
      onComplete={complete}
    >
      <WizardStep
        consultation={consultation}
        step={step}
        notes={notes}
        setNotes={setNotes}
        skipReason={skipReason}
        setSkipReason={setSkipReason}
        vitals={vitals}
        setVitals={setVitals}
        saving={saving}
        onSaveNotes={saveNotes}
        onSaveVitals={saveVitals}
        onComplete={complete}
      />
    </ConsultationWizardShell>
  );
}

// Renders the focused form content for the current wizard step.
function WizardStep({
  consultation,
  step,
  notes,
  setNotes,
  skipReason,
  setSkipReason,
  vitals,
  setVitals,
  saving,
  onSaveNotes,
  onSaveVitals,
  onComplete,
}: any) {
  if (step === "details")
    return (
      <div>
        <h3 className="font-semibold">Visit details</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Review the patient context, then continue to clinical assessment.
        </p>
      </div>
    );
  if (step === "vitals")
    return (
      <div className="space-y-4">
        <h3 className="font-semibold">Vitals decision</h3>
        <Textarea
          value={skipReason}
          onChange={(event) => setSkipReason(event.target.value)}
          placeholder="Reason when vital signs are not needed"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Vital
            label="Temperature"
            value={vitals.temperature}
            onChange={(temperature: string) =>
              setVitals({ ...vitals, temperature })
            }
          />
          <Vital
            label="Blood pressure"
            value={vitals.blood_pressure}
            onChange={(blood_pressure: string) =>
              setVitals({ ...vitals, blood_pressure })
            }
          />
          <Vital
            label="Heart rate"
            value={vitals.heart_rate}
            onChange={(heart_rate: string) =>
              setVitals({ ...vitals, heart_rate })
            }
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={saving}
            onClick={() => onSaveVitals(true)}
          >
            Save vitals
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onSaveVitals(false)}
          >
            Vitals not needed
          </Button>
        </div>
      </div>
    );
  if (step === "notes")
    return (
      <div className="space-y-3">
        <h3 className="font-semibold">Consultation outcome</h3>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={8}
          placeholder="Assessment, care provided, and outcome"
        />
        <Button type="button" onClick={onSaveNotes}>
          Save outcome note
        </Button>
      </div>
    );
  if (step === "diagnosis" || step === "prescription" || step === "follow_up")
    return (
      <div>
        <h3 className="font-semibold capitalize">
          {step.replaceAll("_", " ")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This optional section is saved from the clinical record workflow.
        </p>
      </div>
    );
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Review consultation</h3>
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Vitals</p>
          <p className="text-sm font-medium">
            {consultation?.vitals_disposition === "recorded"
              ? "Recorded"
              : skipReason
                ? `Not needed — ${skipReason}`
                : "Not needed"}
          </p>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Outcome note</p>
          <p className="text-sm whitespace-pre-wrap">
            {notes || "No outcome note yet"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Renders one labelled vital-sign input.
function Vital({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
