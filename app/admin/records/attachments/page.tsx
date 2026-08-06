"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, User, Paperclip, Download } from "lucide-react";
import { toast } from "sonner";
import { searchRecordsAction } from "@/actions/admin/records";
import {
  getStudentDocumentsAction,
  type StudentDocumentRow,
  uploadStudentDocumentAction,
} from "@/actions/admin/records-admin";
import { getPatientMedicalRecord } from "@/actions/clinical/records";
import { Pagination } from "@/components/pagination";
import { AttachmentCarousel } from "@/components/medical/attachment-carousel";

type StudentSearchResult = {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
};

export default function AdminRecordsAttachmentsPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentSearchResult | null>(null);
  const [documents, setDocuments] = useState<StudentDocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [documentType, setDocumentType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const paginatedDocuments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return documents.slice(start, start + pageSize);
  }, [documents, page]);
  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize));

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id || searchParams.get("type") !== "student") return;
    void Promise.all([
      getPatientMedicalRecord(id, "student"),
      getStudentDocumentsAction(id),
    ]).then(([recordResult, documentsResult]) => {
      if (recordResult.record) {
        setSelected({
          id,
          first_name: recordResult.record.first_name,
          last_name: recordResult.record.last_name,
          student_number: recordResult.record.identifier,
        });
      }
      if (documentsResult.error) toast.error(documentsResult.error);
      else {
        setDocuments(documentsResult.documents);
        setPage(1);
      }
    });
  }, [searchParams]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await searchRecordsAction(query);
      if (res.error) {
        toast.error(res.error);
        setResults([]);
      } else {
        setResults(res.students as StudentSearchResult[]);
      }
    } finally {
      setSearching(false);
    }
  }

  async function selectStudent(r: StudentSearchResult) {
    setSelected(r);
    setResults([]);
    setQuery("");
    setPage(1);
    setLoadingDocs(true);
    try {
      const res = await getStudentDocumentsAction(r.id);
      if (res.error) {
        toast.error(res.error);
        setDocuments([]);
      } else {
        setDocuments(res.documents);
      }
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleAddDocument() {
    if (!selected || !documentType.trim() || !selectedFile) {
      toast.error("Document type and file are required");
      return;
    }
    setSubmitting(true);
    try {
      const uploadData = new FormData();
      uploadData.append("studentId", selected.id);
      uploadData.append("documentType", documentType);
      uploadData.append("file", selectedFile);
      const res = await uploadStudentDocumentAction(uploadData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Document attached");
        setDocumentType("");
        setSelectedFile(null);
        setShowAdd(false);
        await selectStudent(selected);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record Attachments"
        description="View and manage document attachments for student records."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Find Student</CardTitle>
          <CardDescription className="text-xs">
            Search by name or student number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Student name or number"
              className="h-9"
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
          </div>

          {results.length > 0 && (
            <div className="divide-y rounded-lg border max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectStudent(r)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50/50 transition-colors text-left cursor-pointer"
                >
                  <User className="size-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="text-xs text-zinc-500">{r.student_number}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Student
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {selected.first_name} {selected.last_name}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selected.student_number}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAdd(!showAdd)}
                className="cursor-pointer"
              >
                <Paperclip className="size-3.5 mr-1" />{" "}
                {showAdd ? "Cancel" : "Attach Document"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAdd && (
              <div className="mb-6 rounded-lg border border-zinc-200 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Document Type <span className="text-red-500">*</span>
                    </Label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none"
                    >
                      <option value="">Select type</option>
                      <option value="medical_certificate">
                        Medical Certificate
                      </option>
                      <option value="lab_result">Lab Result</option>
                      <option value="clearance">Clearance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      File <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(event) =>
                        setSelectedFile(event.target.files?.[0] ?? null)
                      }
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">
                      PDF, JPEG, or PNG up to 6 MB.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleAddDocument}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />{" "}
                      Saving...
                    </>
                  ) : (
                    "Attach Document"
                  )}
                </Button>
              </div>
            )}

            {loadingDocs ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="py-10 text-center">
                <Paperclip className="size-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No documents attached for this student.
                </p>
              </div>
            ) : (
              <>
                <section className="rounded-lg border p-4">
                  <h2 className="mb-3 text-sm font-medium">
                    Attachment preview
                  </h2>
                  <AttachmentCarousel attachments={documents} />
                </section>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Document</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Uploaded</th>
                        <th className="px-4 py-3 text-right font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedDocuments.map((doc) => (
                        <tr
                          key={doc.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {doc.file_name || "Unnamed"}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {doc.document_type.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {new Date(doc.uploaded_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs cursor-pointer"
                              >
                                <Download className="size-3.5 mr-1" /> View
                              </Button>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={documents.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  className="mt-4"
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
