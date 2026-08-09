"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  getPatientConsultationHistory,
  type KioskConsultationSummary,
} from "@/actions/rfid/kiosk";
import { ConsultationDetailDialog } from "@/components/clinical/consultation-detail-dialog";

type ClinicalPatientType = "student" | "faculty" | "staff";

interface StaffRecordExtrasProps {
  patientId: string;
  patientType: ClinicalPatientType;
}

// Loads previous consultations beneath the unified compliance record tabs.
export function StaffRecordExtras({
  patientId,
  patientType,
}: StaffRecordExtrasProps) {
  const [consultations, setConsultations] = useState<KioskConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;

    // Fetches read-only consultation history whenever the selected record changes.
    async function loadExtras() {
      setLoading(true);
      setError(null);
      const consultationResult = await getPatientConsultationHistory(
        patientId,
        patientType,
      );

      if (!active) return;

      setConsultations(consultationResult.consultations ?? []);
      setError(consultationResult.error);
      setLoading(false);
    }

    void loadExtras();

    return () => {
      active = false;
    };
  }, [patientId, patientType]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  return (
    <>
      <section className="bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Previous consultations</h2>
        {consultations.length ? (
          <div className="mt-4 divide-y divide-border">
            {consultations.map((consultation) => (
              <button
                className="flex w-full cursor-pointer items-start justify-between gap-4 py-3 text-left hover:bg-muted/50"
                key={consultation.id}
                onClick={() => {
                  setSelectedConsultationId(consultation.id);
                  setDetailDialogOpen(true);
                }}
                type="button"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {consultation.complaint || "Consultation"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatConsultationDate(consultation.checkedInAt)}
                  </p>
                </div>
                <span className="text-xs capitalize text-muted-foreground">
                  {consultation.status}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No previous consultations found.
          </p>
        )}
      </section>

      <ConsultationDetailDialog
        consultationId={selectedConsultationId}
        onOpenChange={setDetailDialogOpen}
        open={detailDialogOpen}
      />
    </>
  );
}

// Formats a consultation date with the same short form used by Student Records.
function formatConsultationDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
