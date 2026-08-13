"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FileText,
  Loader2,
  ServerCog,
  Stethoscope,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  claimConsultationAction,
} from "@/actions/clinical/visits/workflow";
import {
  getComplianceRecordAction,
  type ComplianceRecordDTO,
} from "@/actions/clinical/records/compliance";
import {
  getRfidQueueAction,
  getRfidServerlessDiagnosticAction,
  type RfidQueueItem,
  type RfidServerlessDiagnostic,
} from "@/actions/rfid/queue";
import {
  HealthRecordTabs,
  type HealthRecordTab,
} from "@/components/medical/health-record-tabs";
import { DataTablePagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient as createBrowserClient } from "@/utils/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ClinicRole = "admin" | "doctor" | "nurse";
const PAGE_SIZE = 10;

interface ClinicalRfidKioskWorkspaceProps {
  role: ClinicRole;
}

// Renders the full-width clinical RFID queue and selected read-only record preview.
export function ClinicalRfidKioskWorkspace({
  role,
}: ClinicalRfidKioskWorkspaceProps) {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());
  const [queue, setQueue] = useState<RfidQueueItem[]>([]);
  const [queuePage, setQueuePage] = useState(1);
  const [selected, setSelected] = useState<RfidQueueItem | null>(null);
  const [record, setRecord] = useState<ComplianceRecordDTO | null>(null);
  const [previewTab, setPreviewTab] = useState<HealthRecordTab>("profile");
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] =
    useState<RfidServerlessDiagnostic | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [startingConsultationId, setStartingConsultationId] = useState<
    string | null
  >(null);
  const previewRequestId = useRef(0);

  // Refreshes only queue entries the active clinician is allowed to open.
  const loadQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const result = await getRfidQueueAction();
    setQueue(result.queue);
    setError(result.error);
    setLoading(false);
  }, []);

  // Subscribes to private queue invalidations and reloads minimized server DTOs.
  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    let reloadTimer: number | undefined;
    const channel = supabase.channel("clinic:rfid-queue", {
      config: { private: true },
    });

    void supabase.realtime.setAuth().then(() => {
      channel
        .on("broadcast", { event: "queue-changed" }, () => {
          window.clearTimeout(reloadTimer);
          reloadTimer = window.setTimeout(() => {
            setQueuePage(1);
            void loadQueue(false);
          }, 100);
        })
        .subscribe();
    });

    return () => {
      window.clearTimeout(initialLoad);
      window.clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadQueue, supabase]);

  // Loads sanitized serverless rollout state for Admin operators only.
  useEffect(() => {
    if (role !== "admin") return;
    async function loadDiagnostic() {
      const result = await getRfidServerlessDiagnosticAction();
      if (!result.error) setDiagnostic(result.diagnostic);
    }
    void loadDiagnostic();
  }, [role, queue]);

  // Opens the dedicated touch-friendly scanner without replacing the queue page.
  function openScanner() {
    window.open("/rfid-kiosk/scanner", "_blank", "noopener,noreferrer");
  }

  // Opens the selected patient's active consultation in the unified Visit workspace.
  async function startConsultation(item: RfidQueueItem) {
    if (!item.canStartConsultation) return;
    setStartingConsultationId(item.consultationId);
    const result = await claimConsultationAction({
      consultation_id: item.consultationId,
    });
    setStartingConsultationId(null);

    if (!result.success) {
      toast.error(result.error ?? "Unable to claim this consultation");
      return;
    }
    router.push(`/${role}/visits?consultation=${item.consultationId}`);
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
  const loadPatientRecord = useCallback(
    async (item: RfidQueueItem, resetTab: boolean) => {
      const requestId = previewRequestId.current + 1;
      previewRequestId.current = requestId;
      setSelected(item);
      if (resetTab) {
        setRecord(null);
        setPreviewTab("profile");
      }
      setPreviewError(null);
      setPreviewLoading(true);

      const result = await getComplianceRecordAction({
        patientId: item.patientId,
        patientRole: item.patientType,
      });
      if (previewRequestId.current !== requestId) return;
      setRecord(result.record);
      setPreviewError(result.error);

      if (previewRequestId.current === requestId) {
        setPreviewLoading(false);
      }
    },
    [],
  );

  // Selects a new patient and resets the embedded record to Profile Overview.
  function selectPatient(item: RfidQueueItem) {
    setQueuePage(1);
    void loadPatientRecord(item, true);
  }

  const queueTotalPages = Math.ceil(queue.length / PAGE_SIZE);
  const visibleQueue = queue.slice(
    (queuePage - 1) * PAGE_SIZE,
    queuePage * PAGE_SIZE,
  );

  // Refreshes the selected record when its private patient topic is invalidated.
  useEffect(() => {
    if (!selected) return;
    let reloadTimer: number | undefined;
    const topic =
      `patient-record:${selected.patientType}:${selected.patientId}`;
    const channel = supabase.channel(topic, {
      config: { private: true },
    });

    void supabase.realtime.setAuth().then(() => {
      channel
        .on("broadcast", { event: "patient-record-changed" }, () => {
          window.clearTimeout(reloadTimer);
          reloadTimer = window.setTimeout(() => {
            void loadPatientRecord(selected, false);
          }, 100);
        })
        .subscribe();
    });

    return () => {
      window.clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadPatientRecord, selected, supabase]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFID Check-in Queue"
        description="Claim unassigned patients, continue your assigned work, and open the clinic scanner."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={openScanner} type="button">
          <ExternalLink className="size-4" />
          Open scanner display
        </Button>
      </div>

      {role === "admin" && diagnostic && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ServerCog className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-medium">RFID execution diagnostics</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Current operator: {diagnostic.enabledForCurrentOperator
                    ? "Edge Function enabled"
                    : "Legacy RPC fallback"}
                  {diagnostic.canaryRestricted ? " · canary restricted" : ""}
                </p>
              </div>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-medium capitalize">
                Last path: {diagnostic.lastExecutionPath ?? "No recorded scan"}
              </p>
              {diagnostic.lastExecutedAt && (
                <p className="text-muted-foreground">
                  {new Date(diagnostic.lastExecutedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Waiting patients</h2>
              <p className="text-sm text-muted-foreground">
                Unclaimed check-ins remain visible until an operator claims them.
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-primary">
            {queue.length} active
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : queue.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No patients are waiting for this role.
          </p>
        ) : (
          <div>
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
              {visibleQueue.map((item, index) => (
                <TableRow
                  className={
                    selected?.id === item.id
                      ? "cursor-pointer bg-muted"
                      : "cursor-pointer hover:bg-muted/50"
                  }
                  key={item.id}
                  onClick={() => selectPatient(item)}
                >
                  <TableCell className="font-semibold text-muted-foreground">
                    {(queuePage - 1) * PAGE_SIZE + index + 1}
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
                      {item.priority > 0
                        ? "Priority"
                        : item.status.replaceAll("_", " ")}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
            <DataTablePagination
              currentPage={queuePage}
              totalPages={queueTotalPages}
              totalItems={queue.length}
              pageSize={PAGE_SIZE}
              onPageChange={setQueuePage}
              className="mx-6 mb-4"
            />
          </div>
        )}
      </Card>

      {selected && (
        <section aria-live="polite" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Medical record preview</h2>
              <p className="text-sm text-muted-foreground">
                Read-only preview for {selected.patientName}.
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
                  : "Open Employee Records"}
              </Button>
              <Button
                disabled={
                  !selected.canStartConsultation ||
                  startingConsultationId === selected.consultationId
                }
                onClick={() => void startConsultation(selected)}
                type="button"
              >
                {startingConsultationId === selected.consultationId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Stethoscope className="size-4" />
                )}
                {getConsultationActionLabel(selected)}
              </Button>
            </div>
          </div>

          {previewLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-10 w-full" />
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          ) : previewError ? (
            <p className="text-sm text-destructive" role="alert">
              {previewError}
            </p>
          ) : record ? (
            <div className="space-y-6">
              <HealthRecordTabs
                activeTab={previewTab}
                capabilities={{
                  canAddExam: false,
                  canAddSickLeave: false,
                }}
                key={record.profile.id}
                onTabChange={setPreviewTab}
                readOnly
                record={record}
                role={record.profile.role}
                showPreviousConsultations
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

// Describes whether the selected queue entry will be claimed, resumed, or reviewed.
function getConsultationActionLabel(item: RfidQueueItem): string {
  if (item.status === "awaiting_doctor_review") {
    return "Review consultation";
  }
  if (item.claimedByCurrentUser) {
    return item.claimedByName
      ? `Resume — ${item.claimedByName}`
      : "Resume consultation";
  }
  if (!item.canStartConsultation) {
    return `Claimed by ${item.claimedByName ?? "clinician"}`;
  }
  return "Start consultation";
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
