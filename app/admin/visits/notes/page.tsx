"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  FileText,
  Loader2,
  Save,
  Search,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import {
  getConsultationQueue,
  type QueueConsultation,
} from "@/actions/inventory/workflow-queries";
import {
  getConsultationDetailAction,
  updateConsultationNotesAction,
  type ConsultationDetailRow,
} from "@/actions/admin/visits-admin";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 6;

// Formats a consultation date for compact queue rows.
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

// Renders an interactive, paginated consultation-notes workspace.
export default function AdminVisitNotesPage() {
  const [consultations, setConsultations] = useState<QueueConsultation[]>([]);
  const [selected, setSelected] = useState<ConsultationDetailRow | null>(null);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Defers the initial request so state changes occur after effect setup.
    void Promise.resolve().then(async () => {
      try {
        const result = await getConsultationQueue();
        if (result.error) {
          toast.error(result.error);
          setConsultations([]);
          return;
        }
        setConsultations(result.consultations);
      } catch {
        toast.error("Failed to load consultations");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const filteredConsultations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return consultations;
    return consultations.filter((consultation) =>
      [consultation.patient_name, consultation.complaint, consultation.status]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [consultations, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredConsultations.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleConsultations = filteredConsultations.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Opens the selected consultation and loads its protected clinical details.
  async function openDetail(id: string) {
    setLoadingDetail(true);
    try {
      const result = await getConsultationDetailAction(id);
      if (result.error || !result.consultation) {
        toast.error(result.error ?? "Consultation details are unavailable");
        return;
      }
      setSelected(result.consultation);
      setNotes(result.consultation.consultation_notes ?? "");
    } finally {
      setLoadingDetail(false);
    }
  }

  // Saves only the notes field through the existing authorized server action.
  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await updateConsultationNotesAction(selected.id, notes);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSelected({ ...selected, consultation_notes: notes });
      toast.success("Consultation notes saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultation Notes"
        description="Select a consultation, review its clinical context, and save structured notes."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden shadow-sm">
          <CardHeader className="space-y-3 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Consultations</CardTitle>
                <CardDescription>Choose a record to edit.</CardDescription>
              </div>
              <Badge variant="outline">{filteredConsultations.length}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
                placeholder="Search consultations"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : visibleConsultations.length === 0 ? (
              <EmptyState
                className="border-0"
                title="No consultations found"
                description="Try another search or wait for checked-in patients."
                icon={Stethoscope}
              />
            ) : (
              <div className="divide-y divide-border">
                {visibleConsultations.map((consultation) => {
                  const isSelected = selected?.id === consultation.id;
                  return (
                    <button
                      key={consultation.id}
                      type="button"
                      onClick={() => openDetail(consultation.id)}
                      className={`w-full cursor-pointer px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {consultation.patient_name}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {consultation.complaint ||
                              "No chief complaint recorded"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 capitalize"
                        >
                          {consultation.status}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(consultation.check_in_time)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
          {!loading && filteredConsultations.length > 0 && (
            <div className="p-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredConsultations.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>

        <Card className="min-h-[560px] shadow-sm">
          <CardHeader className="border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Notes Editor</CardTitle>
                <CardDescription>
                  {selected?.patient_name ??
                    "Select a consultation from the queue"}
                </CardDescription>
              </div>
              {selected && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {selected.status}
                  </Badge>
                  <Dialog>
                    <DialogTrigger
                      render={<Button variant="outline" size="sm" />}
                    >
                      <ClipboardList className="size-4" /> Details
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Consultation summary</DialogTitle>
                        <DialogDescription>
                          Clinical context for {selected.patient_name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 text-sm sm:grid-cols-2">
                        <div className="rounded-md border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            Chief complaint
                          </p>
                          <p className="mt-1 font-medium">
                            {selected.chief_complaint || "Not recorded"}
                          </p>
                        </div>
                        <div className="rounded-md border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            Assigned staff
                          </p>
                          <p className="mt-1 font-medium">
                            {selected.doctor_name ||
                              selected.nurse_name ||
                              "Not assigned"}
                          </p>
                        </div>
                        <div className="rounded-md border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            Diagnoses
                          </p>
                          <p className="mt-1 font-medium">
                            {selected.diagnoses.length}
                          </p>
                        </div>
                        <div className="rounded-md border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            Prescriptions
                          </p>
                          <p className="mt-1 font-medium">
                            {selected.prescriptions.length}
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {loadingDetail ? (
              <div className="flex min-h-96 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !selected ? (
              <EmptyState
                title="Choose a consultation"
                description="The editor will show the selected patient’s protected clinical notes and summary."
                icon={FileText}
              />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-muted/30 p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Chief complaint
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selected.chief_complaint || "Not recorded"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Assigned clinician
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selected.doctor_name ||
                        selected.nurse_name ||
                        "Not assigned"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="consultation-notes"
                    className="text-sm font-medium"
                  >
                    Consultation notes
                  </label>
                  <textarea
                    id="consultation-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={15}
                    className="min-h-80 w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    placeholder="Document assessment, treatment, instructions, and follow-up guidance..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Changes are saved only when you select Save Notes.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={saveNotes}
                    disabled={saving}
                    className="cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <Save className="size-4" /> Save Notes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
