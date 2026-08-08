"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import { Search, Loader2, User, HeartPulse, RefreshCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  searchRecordsAction,
  type RecordSearchResult,
} from "@/actions/admin/records";
import {
  getPatientMedicalRecord,
  type PatientMedicalRecord,
} from "@/actions/clinical/records";
import { MedicalRecordView } from "@/components/medical/medical-record-view";
import { RfidSearchButton } from "@/components/rfid-search-button";
import { ConsultationDetailDialog } from "@/components/clinical/consultation-detail-dialog";
import {
  getStudentDocumentsAction,
  type StudentDocumentRow,
} from "@/actions/admin/records-admin";
import {
  getPatientConsultationHistory,
  type KioskConsultationSummary,
} from "@/actions/rfid/kiosk";
import { AttachmentCarousel } from "@/components/medical/attachment-carousel";
import {
  uploadStudentDocumentAction,
} from "@/actions/admin/records-admin";

// Renders the medical-record workspace for a clinical role.
export function MedicalRecordsViewPage({
  canUpload = true,
}: {
  canUpload?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecordSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<
    Array<{ id: string; name: string; type: "student" | "faculty" }>
  >([]);
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [documents, setDocuments] = useState<StudentDocumentRow[]>([]);
  const [consultationHistory, setConsultationHistory] = useState<KioskConsultationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // RFID kiosk scan handler
  async function handleRfidScan(uid: string) {
    setQuery(uid);
    setSearching(true);
    setSearched(true);
    setPage(1);
    try {
      const res = await searchRecordsAction(uid);
      if (res.error) {
        toast.error(res.error);
        setResults([]);
      } else {
        const combined = [...res.students, ...res.faculty];
        setResults(combined);
        if (combined.length === 1) {
          const r = combined[0];
          const type = "student_number" in r ? "student" : "faculty";
          selectPatient(r);
        }
      }
    } finally {
      setSearching(false);
    }
  }

  // Auto-load record if id query param is present
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const type = searchParams.get("type") as "student" | "faculty" | null;
    if (!type) return;
    setSelectedPatient([{ id, name: "", type }]);
    loadRecord(id, type);
  }, [searchParams]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, page]);

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    setPage(1);
    try {
      const res = await searchRecordsAction(query);
      if (res.error) {
        toast.error(res.error);
        setResults([]);
      } else {
        setResults([...res.students, ...res.faculty]);
      }
    } finally {
      setSearching(false);
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as string;
    if (!file || !documentType) {
      toast.error("Please select a file and document type");
      return;
    }
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.set("studentId", selectedPatient[0]?.id || "");
      uploadFormData.set("documentType", documentType);
      uploadFormData.set("file", file);
      const result = await uploadStudentDocumentAction(uploadFormData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("File uploaded successfully");
        e.currentTarget.reset();
        // Refresh documents list
        const patientId = selectedPatient[0]?.id;
        const patientType = selectedPatient[0]?.type;
        if (patientId && patientType) {
          const documentsResponse = await getStudentDocumentsAction(patientId);
          setDocuments(documentsResponse.documents ?? []);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const loadRecord = useCallback(
    async (patientId: string, patientType: "student" | "faculty") => {
      setLoadingRecord(true);
      setRecord(null);
      try {
        const res = await getPatientMedicalRecord(patientId, patientType);
        if (res.error) {
          toast.error(res.error);
        } else if (res.record) {
          setRecord(res.record);
          if (patientType === "student") {
            const documentsResponse =
              await getStudentDocumentsAction(patientId);
            setDocuments(documentsResponse.documents ?? []);
          } else {
            setDocuments([]);
          }
          // Load consultation history
          setIsLoadingHistory(true);
          const historyResponse = await getPatientConsultationHistory(
            patientId,
            patientType,
          );
          setConsultationHistory(historyResponse.consultations);
          setIsLoadingHistory(false);
        } else {
          toast.error("No medical record found for this patient");
        }
      } finally {
        setLoadingRecord(false);
      }
    },
    [],
  );

  function selectPatient(r: RecordSearchResult) {
    const type = "student_number" in r ? "student" : "faculty";
    const name = `${r.first_name} ${r.last_name}`;
    setSelectedPatient((prev) => {
      if (prev.some((p) => p.id === r.id)) return prev;
      return [...prev, { id: r.id, name, type }];
    });
    loadRecord(r.id, type);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Records"
        description="View complete medical records for students and faculty."
      />

      <Card className="shadow-sm">
        <CardContent className="p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, student number, or employee number"
              className="h-9 flex-1 min-w-[200px]"
            />
            <Button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="shrink-0 cursor-pointer"
            >
              {searching ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <Search className="size-3.5 mr-1" />
              )}
              Search
            </Button>
            <RfidSearchButton
              onResults={(results) => {
                setResults(results);
                setSearched(true);
                setPage(1);
                if (results.length === 1) {
                  selectPatient(results[0]);
                }
              }}
            />
          </div>

          {searched && results.length === 0 ? (
            <div className="py-10 text-center">
              <User className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No patients found. Try a different search term.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>ID No.</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-[1px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length > 0 ? (
                      paginated.map((r) => {
                        const patientType =
                          "student_number" in r ? "student" : "faculty";
                        return (
                          <TableRow
                            key={r.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => selectPatient(r)}
                          >
                            <TableCell className="font-medium">
                              {r.first_name} {r.last_name}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {"student_number" in r
                                ? r.student_number
                                : r.employee_number}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.department ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-[10px] capitalize"
                              >
                                {patientType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs cursor-pointer"
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <User className="size-8 text-zinc-300" />
                            <p className="text-sm text-muted-foreground">
                              Search for patients to view their medical records
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={results.length}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {selectedPatient.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {selectedPatient.map((p) => (
            <Button
              key={p.id}
              variant={
                record && p.id === record.patient_id ? "default" : "outline"
              }
              size="sm"
              onClick={() => loadRecord(p.id, p.type)}
              disabled={loadingRecord}
              className="cursor-pointer"
            >
              <HeartPulse className="size-3.5 mr-1" />
              {p.name}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedPatient([]);
              setRecord(null);
            }}
            className="cursor-pointer"
          >
            <RefreshCcw className="size-3.5 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {loadingRecord ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : record ? (
        <div className="space-y-6">
          <MedicalRecordView
            record={record}
            canEdit={true}
            onUpdated={() => loadRecord(record.patient_id, record.patient_type)}
          />
          <section className="bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Files & attachments</h2>
              {canUpload && selectedPatient[0]?.type === "student" && (
                <form
                  onSubmit={handleUpload}
                  className="flex items-center gap-2"
                >
                  <select
                    name="documentType"
                    className="h-8 px-2 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    <option value="">Type</option>
                    <option value="medical_certificate">Medical Certificate</option>
                    <option value="lab_result">Lab Result</option>
                    <option value="prescription">Prescription</option>
                    <option value="immunization">Immunization</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="file"
                    name="file"
                    className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={uploading}
                    className="h-8 cursor-pointer"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                  </Button>
                </form>
              )}
            </div>
            {documents.length ? (
              <AttachmentCarousel attachments={documents} className="mt-4" />
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No attachments found.
              </p>
            )}
          </section>
          <section className="bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Previous consultations</h2>
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
      ) : selectedPatient.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HeartPulse className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Select a patient above to view their medical record.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ConsultationDetailDialog
        consultationId={selectedConsultationId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}

export default MedicalRecordsViewPage;
