"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Stethoscope, User } from "lucide-react";
import { toast } from "sonner";
import {
  searchRecordsAction,
  type RecordSearchResult,
} from "@/actions/admin/records";
import {
  addMedicalHistory,
  getPatientMedicalRecord,
  type MedicalHistory,
} from "@/actions/clinical/records";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PatientType = "student" | "faculty";

type SelectedPatient = {
  id: string;
  firstName: string;
  lastName: string;
  identifier: string;
  type: PatientType;
};

const PAGE_SIZE = 10;

export default function AdminMedicalHistoryPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecordSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] =
    useState<SelectedPatient | null>(null);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    conditionName: "",
    diagnosedDate: "",
    status: "active",
    notes: "",
  });

  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return medicalHistory.slice(start, start + PAGE_SIZE);
  }, [medicalHistory, page]);
  const totalPages = Math.max(1, Math.ceil(medicalHistory.length / PAGE_SIZE));

  /** Looks up students and faculty before a medical-history record is opened. */
  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const result = await searchRecordsAction(query);
      if (result.error) {
        toast.error(result.error);
        setResults([]);
        return;
      }
      setResults([...result.students, ...result.faculty]);
    } finally {
      setSearching(false);
    }
  }

  /** Loads one patient's profile and full medical-history list. */
  async function loadPatient(id: string, type: PatientType) {
    setLoadingHistory(true);
    try {
      const result = await getPatientMedicalRecord(id, type);
      if (result.error || !result.record) {
        toast.error(result.error || "Medical record not found");
        return;
      }
      setSelectedPatient({
        id,
        firstName: result.record.first_name,
        lastName: result.record.last_name,
        identifier: result.record.identifier,
        type,
      });
      setMedicalHistory(result.record.medical_history);
      setPage(1);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    const id = searchParams.get("id");
    const type = searchParams.get("type") as PatientType | null;
    if (!id || (type !== "student" && type !== "faculty")) return;
    let isCurrent = true;

    void getPatientMedicalRecord(id, type).then((result) => {
      if (!isCurrent || result.error || !result.record) {
        if (isCurrent) toast.error(result.error || "Medical record not found");
        return;
      }
      setSelectedPatient({
        id,
        firstName: result.record.first_name,
        lastName: result.record.last_name,
        identifier: result.record.identifier,
        type,
      });
      setMedicalHistory(result.record.medical_history);
      setPage(1);
    });

    return () => {
      isCurrent = false;
    };
  }, [searchParams]);

  /** Selects a result and clears the temporary search result list. */
  async function selectPatient(result: RecordSearchResult) {
    const type: PatientType =
      "student_number" in result ? "student" : "faculty";
    setResults([]);
    setQuery("");
    await loadPatient(result.id, type);
  }

  /** Saves a doctor-entered medical-history item through the existing action. */
  async function handleAddHistory() {
    if (!selectedPatient || !form.conditionName.trim()) {
      toast.error("Condition name is required");
      return;
    }
    setSubmitting(true);
    try {
      const result = await addMedicalHistory(
        selectedPatient.id,
        selectedPatient.type,
        {
          condition_name: form.conditionName,
          diagnosed_date: form.diagnosedDate || undefined,
          status: form.status,
          notes: form.notes || undefined,
        },
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Medical history added");
      setForm({
        conditionName: "",
        diagnosedDate: "",
        status: "active",
        notes: "",
      });
      setShowAdd(false);
      await loadPatient(selectedPatient.id, selectedPatient.type);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical History"
        description="Review documented conditions and add a history item when permitted."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Find Patient</CardTitle>
          <CardDescription className="text-xs">
            Search by name, student number, or employee number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              placeholder="Patient name or ID number"
            />
            <Button
              className="shrink-0 cursor-pointer"
              disabled={searching || !query.trim()}
              onClick={handleSearch}
            >
              <Search className="mr-1 size-3.5" />
              {searching ? "Searching..." : "Search"}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="divide-y rounded-lg border">
              {results.map((result) => (
                <button
                  className="flex w-full cursor-pointer items-center gap-3 p-3 text-left hover:bg-muted/50"
                  key={result.id}
                  onClick={() => void selectPatient(result)}
                  type="button"
                >
                  <User className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {result.first_name} {result.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {"student_number" in result
                      ? result.student_number
                      : result.employee_number}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPatient && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedPatient.identifier}
                </CardDescription>
              </div>
              <Button
                className="cursor-pointer"
                onClick={() => setShowAdd((current) => !current)}
                size="sm"
              >
                <Plus className="mr-1 size-3.5" />
                {showAdd ? "Cancel" : "Add medical history"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {showAdd && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="condition-name">Condition name</Label>
                    <Input
                      id="condition-name"
                      onChange={(event) =>
                        setForm({ ...form, conditionName: event.target.value })
                      }
                      value={form.conditionName}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="diagnosed-date">Diagnosed date</Label>
                    <Input
                      id="diagnosed-date"
                      onChange={(event) =>
                        setForm({ ...form, diagnosedDate: event.target.value })
                      }
                      type="date"
                      value={form.diagnosedDate}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="history-status">Status</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      id="history-status"
                      onChange={(event) =>
                        setForm({ ...form, status: event.target.value })
                      }
                      value={form.status}
                    >
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                      <option value="monitoring">Monitoring</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="history-notes">Clinical notes</Label>
                    <Textarea
                      id="history-notes"
                      onChange={(event) =>
                        setForm({ ...form, notes: event.target.value })
                      }
                      rows={2}
                      value={form.notes}
                    />
                  </div>
                </div>
                <Button
                  className="cursor-pointer"
                  disabled={submitting}
                  onClick={handleAddHistory}
                  size="sm"
                >
                  {submitting ? "Saving..." : "Save medical history"}
                </Button>
              </div>
            )}

            {loadingHistory ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Loading medical history...
              </div>
            ) : medicalHistory.length === 0 ? (
              <div className="py-10 text-center">
                <Stethoscope className="mx-auto mb-2 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No medical history recorded for this patient.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedHistory.map((history) => (
                    <article className="rounded-lg border p-4" key={history.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="font-medium">{history.condition}</h2>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Diagnosed:{" "}
                            {history.diagnosed_date || "Not recorded"}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
                          {history.status}
                        </span>
                      </div>
                      {history.notes && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {history.notes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                <Pagination
                  currentPage={page}
                  onPageChange={setPage}
                  pageSize={PAGE_SIZE}
                  totalItems={medicalHistory.length}
                  totalPages={totalPages}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
