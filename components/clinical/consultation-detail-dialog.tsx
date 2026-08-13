"use client";

import { useEffect, useState } from "react";
import { Loader2, Stethoscope, HeartPulse, Pill, FileText, User, CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getConsultationDetailAction, type ConsultationDetailRow } from "@/actions/clinical/visits/queries";
import { toast } from "sonner";

interface ConsultationDetailDialogProps {
  consultationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Displays one role-authorized consultation in a reusable detail dialog.
export function ConsultationDetailDialog({
  consultationId,
  open,
  onOpenChange,
}: ConsultationDetailDialogProps) {
  const [consultation, setConsultation] = useState<ConsultationDetailRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !consultationId) return;
    let cancelled = false;
    const initialLoad = window.setTimeout(() => {
      setLoading(true);
      setConsultation(null);
      void getConsultationDetailAction(consultationId)
        .then((res) => {
          if (cancelled) return;
          if (res.error) {
            toast.error(res.error);
          } else if (res.consultation) {
            setConsultation(res.consultation);
          } else {
            toast.error("Consultation not found");
          }
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load consultation",
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(initialLoad);
    };
  }, [consultationId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            Consultation Details
          </DialogTitle>
          <DialogDescription>
            {consultation?.patient_name ?? "Loading patient information..."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !consultation ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No consultation details available.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Status & Timestamps */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] capitalize">
                {consultation.status?.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline" className="text-[10px] capitalize">
                {consultation.vitals_disposition?.replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="size-3" />
                {new Date(consultation.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {consultation.completed_at && (
                <span className="text-xs text-muted-foreground">
                  · Completed{" "}
                  {new Date(consultation.completed_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>

            {/* Visit reason */}
            <section className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Visit reason
              </h3>
              <p className="text-sm text-foreground">
                {consultation.patient_complaint || "No visit reason recorded"}
              </p>
            </section>

            {/* Assigned Staff */}
            <section className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <User className="size-4 text-primary" />
                Assigned Staff
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Doctor</p>
                  <p className="font-medium">{consultation.doctor_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nurse</p>
                  <p className="font-medium">{consultation.nurse_name || "—"}</p>
                </div>
              </div>
            </section>

            {/* Vitals / Triage */}
            {consultation.triage && (
              <section className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <HeartPulse className="size-4 text-primary" />
                  Vitals / Triage
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {consultation.triage.temperature != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Temperature</p>
                      <p className="font-medium">{consultation.triage.temperature}°C</p>
                    </div>
                  )}
                  {consultation.triage.blood_pressure && (
                    <div>
                      <p className="text-xs text-muted-foreground">Blood Pressure</p>
                      <p className="font-medium">{consultation.triage.blood_pressure}</p>
                    </div>
                  )}
                  {consultation.triage.heart_rate != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Heart Rate</p>
                      <p className="font-medium">{consultation.triage.heart_rate} bpm</p>
                    </div>
                  )}
                  {consultation.triage.respiratory_rate != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Respiratory Rate</p>
                      <p className="font-medium">{consultation.triage.respiratory_rate} /min</p>
                    </div>
                  )}
                  {consultation.triage.oxygen_saturation != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">O₂ Saturation</p>
                      <p className="font-medium">{consultation.triage.oxygen_saturation}%</p>
                    </div>
                  )}
                  {consultation.triage.weight != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Weight</p>
                      <p className="font-medium">{consultation.triage.weight} kg</p>
                    </div>
                  )}
                  {consultation.triage.height != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Height</p>
                      <p className="font-medium">{consultation.triage.height} cm</p>
                    </div>
                  )}
                  {consultation.triage.triage_level && (
                    <div>
                      <p className="text-xs text-muted-foreground">Triage Level</p>
                      <p className="font-medium capitalize">{consultation.triage.triage_level}</p>
                    </div>
                  )}
                </div>
                {consultation.triage.symptoms && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">Symptoms</p>
                    <p className="text-sm">{consultation.triage.symptoms}</p>
                  </div>
                )}
                {consultation.triage.notes && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Triage Notes</p>
                    <p className="text-sm">{consultation.triage.notes}</p>
                  </div>
                )}
              </section>
            )}

            {/* Diagnoses */}
            {consultation.diagnoses.length > 0 && (
              <section className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Diagnoses</h3>
                <div className="space-y-2">
                  {consultation.diagnoses.map((d) => (
                    <div key={d.id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">{d.description || "—"}</p>
                        {d.icd10_code && (
                          <p className="text-xs text-muted-foreground">ICD-10: {d.icd10_code}</p>
                        )}
                      </div>
                      {d.is_primary && (
                        <Badge variant="outline" className="text-[10px] shrink-0">Primary</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Treatments */}
            {consultation.treatments.length > 0 && (
              <section className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Treatments</h3>
                <div className="space-y-3">
                  {consultation.treatments.map((t) => (
                    <div key={t.id} className="text-sm">
                      <p className="font-medium">{t.treatment_plan || "—"}</p>
                      {t.instructions && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t.instructions}</p>
                      )}
                      {t.follow_up_days && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Follow-up in {t.follow_up_days} day(s)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Prescriptions */}
            {consultation.prescriptions.length > 0 && (
              <section className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Pill className="size-4 text-primary" />
                  Prescriptions
                </h3>
                <div className="space-y-2">
                  {consultation.prescriptions.map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">{p.medicine_name || "—"}</p>
                        {p.dosage && (
                          <p className="text-xs text-muted-foreground">Dosage: {p.dosage}</p>
                        )}
                        {p.quantity != null && (
                          <p className="text-xs text-muted-foreground">Qty: {p.quantity}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                        {p.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Consultation Notes */}
            <section className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Consultation Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap text-foreground">
                {consultation.consultation_notes || "No notes recorded"}
              </p>
            </section>

            {/* Vitals Skip Reason */}
            {consultation.vitals_skip_reason && (
              <section className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-2">Vitals Skip Reason</h3>
                <p className="text-sm text-foreground">{consultation.vitals_skip_reason}</p>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
