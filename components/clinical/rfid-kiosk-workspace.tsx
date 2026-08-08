"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Stethoscope,
  Users,
} from "lucide-react";

import {
  getPatientMedicalRecord,
  type PatientMedicalRecord,
} from "@/actions/clinical/records";
import {
  getStaffMedicalRecord,
  type StaffMedicalRecord,
} from "@/actions/clinical/staff-records";
import { getRfidQueue, type RfidQueueItem } from "@/actions/rfid/kiosk";
import { MedicalRecordView } from "@/components/medical/medical-record-view";
import { StaffMedicalRecordView } from "@/components/medical/staff-medical-record-view";
import { StaffRecordExtras } from "@/components/medical/staff-record-extras";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ClinicRole = "admin" | "doctor" | "nurse";

interface ClinicalRfidKioskWorkspaceProps {
  role: ClinicRole;
}

// Renders the full-width clinical RFID queue and selected read-only record preview.
export function ClinicalRfidKioskWorkspace({
  role,
}: ClinicalRfidKioskWorkspaceProps) {
  const router = useRouter();
  const [queue, setQueue] = useState<RfidQueueItem[]>([]);
  const [selected, setSelected] = useState<RfidQueueItem | null>(null);
  const [patientRecord, setPatientRecord] =
    useState<PatientMedicalRecord | null>(null);
  const [staffRecord, setStaffRecord] = useState<StaffMedicalRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestId = useRef(0);

  // Refreshes only queue entries the active clinician is allowed to open.
  const loadQueue = useCallback(async () => {
    setLoading(true);
    const result = await getRfidQueue();
    setQueue(result.queue);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    const interval = window.setInterval(loadQueue, 300_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadQueue]);

  // Opens the dedicated touch-friendly scanner without replacing the queue page.
  function openScanner() {
    window.open("/rfid-kiosk/scanner", "_blank", "noopener,noreferrer");
  }

  // Opens the selected patient's active consultation in the unified Visit workspace.
  function startConsultation(item: RfidQueueItem) {
    window.location.assign(`/${role}/visits?consultation=${item.consultationId}`);
  }

  // Opens the role-owned complete record page for the selected patient.
  function openFullRecord(item: RfidQueueItem) {
    const recordPath =
      item.patientType === "student"
        ? `/${role}/records/view?id=${item.patientId}&type=student`
        : `/${role}/staffhealth/record?id=${item.patientId}&type=${item.patientType}`;

    router.push(recordPath);
  }

  // Selects a queue entry and loads its read-only clinical record beneath the table.
  async function selectPatient(item: RfidQueueItem) {
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;
    setSelected(item);
    setPatientRecord(null);
    setStaffRecord(null);
    setPreviewError(null);
    setPreviewLoading(true);

    if (item.patientType === "staff") {
      const result = await getStaffMedicalRecord(item.patientId);
      if (previewRequestId.current !== requestId) return;
      setStaffRecord(result.record);
      setPreviewError(result.error);
    } else {
      const result = await getPatientMedicalRecord(
        item.patientId,
        item.patientType,
      );
      if (previewRequestId.current !== requestId) return;
      setPatientRecord(result.record);
      setPreviewError(result.error);
    }

    if (previewRequestId.current === requestId) {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFID Check-in Queue"
        description={
          role === "admin"
            ? "Monitor every checked-in patient and open the clinic scanner."
            : "View your assigned checked-in patients and open the clinic scanner."
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={openScanner} type="button">
          <ExternalLink className="size-4" />
          Open scanner display
        </Button>
        <Button
          disabled={loading}
          onClick={() => void loadQueue()}
          type="button"
          variant="outline"
        >
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          Refresh queue
        </Button>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Waiting patients</h2>
              <p className="text-sm text-muted-foreground">
                Select a patient to preview their record or start their visit.
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-primary">
            {queue.length} active
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : queue.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No assigned patients are waiting.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">#</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Checked in</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((item, index) => (
                <TableRow
                  className={
                    selected?.id === item.id
                      ? "cursor-pointer bg-muted"
                      : "cursor-pointer hover:bg-muted/50"
                  }
                  key={item.id}
                  onClick={() => void selectPatient(item)}
                >
                  <TableCell className="font-semibold text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {item.profilePhotoUrl ? (
                          // Profile images may be signed URLs or validated database data URLs.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="size-full object-cover"
                            src={item.profilePhotoUrl}
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                            {getInitials(item.patientName)}
                          </div>
                        )}
                      </div>
                      <span className="font-medium">{item.patientName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className="text-[10px] capitalize"
                      variant="outline"
                    >
                      {item.patientType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatCheckedIn(item.checkedInAt)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        item.priority > 0
                          ? "text-sm font-semibold text-warning"
                          : "text-sm capitalize text-muted-foreground"
                      }
                    >
                      {item.priority > 0 ? "Priority" : item.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {selected && (
        <section aria-live="polite" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Medical record preview</h2>
              <p className="text-sm text-muted-foreground">
                Read-only preview for {selected.patientName}; record changes are
                unavailable from the RFID queue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => openFullRecord(selected)}
                type="button"
                variant="outline"
              >
                <FileText className="size-4" />
                {selected.patientType === "student"
                  ? "Open Student Records"
                  : "Open Faculty & Staff Records"}
              </Button>
              <Button onClick={() => startConsultation(selected)} type="button">
                <Stethoscope className="size-4" />
                Start consultation
              </Button>
            </div>
          </div>

          {previewLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : previewError ? (
            <p className="text-sm text-destructive" role="alert">
              {previewError}
            </p>
          ) : patientRecord ? (
            <div className="space-y-6">
              <MedicalRecordView
                canEdit={false}
                profilePhotoUrl={selected.profilePhotoUrl}
                record={patientRecord}
              />
              <StaffRecordExtras
                patientId={selected.patientId}
                patientType={selected.patientType}
              />
            </div>
          ) : staffRecord ? (
            <div className="space-y-6">
              <StaffMedicalRecordView
                profilePhotoUrl={selected.profilePhotoUrl}
                record={staffRecord}
              />
              <StaffRecordExtras
                patientId={selected.patientId}
                patientType="staff"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No medical record is available for this patient.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

// Derives an accessible fallback avatar label from a patient name.
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Formats a queue timestamp without combining incompatible Intl date options.
function formatCheckedIn(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
