"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { getFacultyDocumentsAction } from "@/actions/admin/faculty-documents";
import { getStudentDocumentsAction } from "@/actions/admin/records-admin";
import { getStaffDocumentsAction } from "@/actions/admin/staff-documents";
import {
  getPatientConsultationHistory,
  type KioskConsultationSummary,
} from "@/actions/rfid/kiosk";
import { ConsultationDetailDialog } from "@/components/clinical/consultation-detail-dialog";
import {
  AttachmentCarousel,
  type AttachmentCarouselItem,
} from "@/components/medical/attachment-carousel";

type ClinicalPatientType = "student" | "faculty" | "staff";

interface StaffRecordExtrasProps {
  patientId: string;
  patientType: ClinicalPatientType;
}

// Loads read-only files and completed consultations for any selected clinical record.
export function StaffRecordExtras({
  patientId,
  patientType,
}: StaffRecordExtrasProps) {
  const [attachments, setAttachments] = useState<AttachmentCarouselItem[]>([]);
  const [consultations, setConsultations] = useState<KioskConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;

    // Fetches both read-only sections together whenever the selected record changes.
    async function loadExtras() {
      setLoading(true);
      setError(null);
      const [documentResult, consultationResult] = await Promise.all([
        getPatientDocuments(patientId, patientType),
        getPatientConsultationHistory(patientId, patientType),
      ]);

      if (!active) return;

      setAttachments(documentResult.documents ?? []);
      setConsultations(consultationResult.consultations ?? []);
      setError(documentResult.error ?? consultationResult.error);
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
        <h2 className="text-lg font-semibold">Files & attachments</h2>
        {attachments.length ? (
          <AttachmentCarousel attachments={attachments} className="mt-4" />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No attachments found.
          </p>
        )}
      </section>

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

// Selects the role-owned document source without exposing storage access to the browser.
function getPatientDocuments(patientId: string, patientType: ClinicalPatientType) {
  if (patientType === "student") {
    return getStudentDocumentsAction(patientId);
  }

  if (patientType === "faculty") {
    return getFacultyDocumentsAction(patientId);
  }

  return getStaffDocumentsAction(patientId);
}

// Formats a consultation date with the same short form used by Student Records.
function formatConsultationDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
