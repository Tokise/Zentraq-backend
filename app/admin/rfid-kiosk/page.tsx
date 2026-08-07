"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, RefreshCw, Users } from "lucide-react";

import { getRfidQueue, type RfidQueueItem } from "@/actions/rfid/kiosk";
import {
  getPatientMedicalRecord,
  type PatientMedicalRecord,
} from "@/actions/clinical/records";
import {
  getStudentDocumentsAction,
  type StudentDocumentRow,
} from "@/actions/admin/records-admin";
import {
  getPatientConsultationHistory,
  type KioskConsultationSummary,
} from "@/actions/rfid/kiosk";
import { AttachmentCarousel } from "@/components/medical/attachment-carousel";
import { PatientClinicalSectionGrid } from "@/components/medical/patient-clinical-section-grid";
import { ConsultationDetailDialog } from "@/components/clinical/consultation-detail-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

// Renders the staff-only RFID queue and read-only patient snapshot.
export default function AdminRfidKioskPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<RfidQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RfidQueueItem | null>(null);
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null);
  const [documents, setDocuments] = useState<StudentDocumentRow[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [consultationHistory, setConsultationHistory] = useState<KioskConsultationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Loads the current queue through the authorized server action.
  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    const response = await getRfidQueue();
    setQueue(response.queue);
    setError(response.error);
    setIsLoading(false);
  }, []);

  // Opens the isolated scanner display in a separate browser tab.
  function openScanner() {
    window.open("/rfid-kiosk/scanner", "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    void loadQueue();
    const interval = window.setInterval(loadQueue, 300000);
    return () => window.clearInterval(interval);
  }, [loadQueue]);

  useEffect(() => {
    if (!selected) return;
    const selectedPatient = selected;

    // Loads the protected clinical record only after staff selects a queue entry.
    async function loadPatientWorkspace() {
      setIsLoadingDetails(true);
      const recordResponse = await getPatientMedicalRecord(
        selectedPatient.patientId,
        selectedPatient.patientType,
      );
      setRecord(recordResponse.record ?? null);

      if (selectedPatient.patientType === "student") {
        const documentsResponse = await getStudentDocumentsAction(
          selectedPatient.patientId,
        );
        setDocuments(documentsResponse.documents ?? []);
      } else {
        setDocuments([]);
      }

      // Load consultation history
      setIsLoadingHistory(true);
      const historyResponse = await getPatientConsultationHistory(
        selectedPatient.patientId,
        selectedPatient.patientType,
      );
      setConsultationHistory(historyResponse.consultations);
      setIsLoadingHistory(false);

      setIsLoadingDetails(false);
    }

    void loadPatientWorkspace();
  }, [selected]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFID Check-in Queue"
        description="Open the scanner for patients, then manage the live clinical worklist here."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={openScanner}>
          <ExternalLink className="size-4" />
          Open scanner display
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={loadQueue}
          disabled={isLoading}
        >
          <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
          Refresh queue
        </Button>
      </div>

      <section className="bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Waiting patients</h2>
              <p className="text-sm text-muted-foreground">
                FIFO by arrival, with urgent patients first.
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-primary">
            {queue.length} active
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p role="alert" className="p-6 text-destructive">
            {error}
          </p>
        ) : queue.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">
            No patients are waiting to be seen.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {queue.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left hover:bg-muted"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="w-6 font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{item.patientName}</p>
                    <p className="text-sm capitalize text-muted-foreground">
                      {item.patientType} · checked in{" "}
                      {new Date(item.checkedInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={
                    item.priority > 0
                      ? "text-sm font-semibold text-warning"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {item.priority > 0 ? "Priority" : item.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <section className="border-t border-border pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Patient details</h2>
              <p className="text-sm text-muted-foreground">
                {selected.patientName} · checked in{" "}
                {new Date(selected.checkedInAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  `/admin/records/view?id=${selected.patientId}&type=${selected.patientType}`,
                )
              }
            >
              Open patient record
            </Button>
          </div>

          <Button
            type="button"
            className="mb-5 w-full"
            onClick={() =>
              router.push(
                `/admin/visits?consultation=${selected.consultationId}`,
              )
            }
          >
            Start consultation
          </Button>

          {isLoadingDetails ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : record ? (
            <div className="space-y-5">
              <PatientClinicalSectionGrid record={record} canEdit={false} />
              <section className="bg-card p-6 shadow-sm">
                <h3 className="font-semibold">Files & attachments</h3>
                {documents.length ? (
                  <AttachmentCarousel
                    attachments={documents}
                    className="mt-4"
                  />
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No attachments found.
                  </p>
                )}
              </section>
              <section className="bg-card p-6 shadow-sm">
                <h3 className="font-semibold">Previous consultations</h3>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : consultationHistory.length > 0 ? (
                  <div className="mt-4 divide-y divide-border">
                    {consultationHistory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setSelectedConsultationId(entry.id);
                          setDetailDialogOpen(true);
                        }}
                        className="flex w-full cursor-pointer items-start justify-between gap-4 py-3 text-left hover:bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.complaint || "Consultation"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.checkedInAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <span className="text-xs capitalize text-muted-foreground">{entry.status}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No previous consultations found.</p>
                )}
              </section>
            </div>
          ) : null}
        </section>
      )}

      <ConsultationDetailDialog
        consultationId={selectedConsultationId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
