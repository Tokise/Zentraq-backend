"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  HeartPulse,
  Loader2,
  RefreshCcw,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { searchRecordsAction } from "@/actions/admin/records";
import {
  getPatientMedicalRecord,
  type PatientMedicalRecord,
} from "@/actions/clinical/records";
import {
  getStaffMedicalRecord,
  type StaffMedicalRecord,
} from "@/actions/clinical/staff-records";
import { MedicalRecordView } from "@/components/medical/medical-record-view";
import { StaffMedicalRecordView } from "@/components/medical/staff-medical-record-view";
import { StaffRecordExtras } from "@/components/medical/staff-record-extras";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StaffHealthPatientType = "faculty" | "staff";

type StaffHealthSearchResult = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  department: string | null;
  patientType: StaffHealthPatientType;
};

const PAGE_SIZE = 10;

// Renders the faculty and staff records workspace with the standard record-view layout.
export default function AdminStaffHealthRecordPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffHealthSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedPatient, setSelectedPatient] =
    useState<StaffHealthSearchResult | null>(null);
  const [facultyRecord, setFacultyRecord] =
    useState<PatientMedicalRecord | null>(null);
  const [staffRecord, setStaffRecord] = useState<StaffMedicalRecord | null>(
    null,
  );
  const [loadingRecord, setLoadingRecord] = useState(false);

  // Loads a faculty or staff record beneath the same search results table.
  const loadRecord = useCallback(
    async (patient: StaffHealthSearchResult) => {
      setSelectedPatient(patient);
      setFacultyRecord(null);
      setStaffRecord(null);
      setLoadingRecord(true);

      try {
        if (patient.patientType === "staff") {
          const result = await getStaffMedicalRecord(patient.id);
          if (result.error) {
            toast.error(result.error);
          } else if (result.record) {
            setStaffRecord(result.record);
            setSelectedPatient({
              ...patient,
              first_name: result.record.profile.first_name,
              last_name: result.record.profile.last_name,
              employee_number: result.record.profile.employee_number,
              department: result.record.profile.department,
            });
          }
          return;
        }

        const result = await getPatientMedicalRecord(patient.id, "faculty");
        if (result.error) {
          toast.error(result.error);
        } else if (result.record) {
          setFacultyRecord(result.record);
          setSelectedPatient({
            ...patient,
            first_name: result.record.first_name,
            last_name: result.record.last_name,
            employee_number: result.record.identifier,
            department: result.record.department,
          });
        } else {
          toast.error("No medical record found for this faculty member.");
        }
      } finally {
        setLoadingRecord(false);
      }
    },
    [],
  );

  // Searches only faculty and staff profiles for this dedicated records workspace.
  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    setPage(1);

    try {
      const result = await searchRecordsAction(query);
      if (result.error) {
        toast.error(result.error);
        setResults([]);
        return;
      }

      setResults([
        ...result.faculty.map((profile) => ({
          ...profile,
          patientType: "faculty" as const,
        })),
        ...result.staff.map((profile) => ({
          ...profile,
          patientType: "staff" as const,
        })),
      ]);
    } finally {
      setSearching(false);
    }
  }

  // Opens a kiosk-selected faculty or staff record on initial page load.
  useEffect(() => {
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    if (!id || (type !== "faculty" && type !== "staff")) return;

    const initialLoad = window.setTimeout(() => {
      void loadRecord({
        id,
        first_name: "",
        last_name: "",
        employee_number: "",
        department: null,
        patientType: type,
      });
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [loadRecord, searchParams]);

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return results.slice(start, start + PAGE_SIZE);
  }, [page, results]);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty & Staff Records"
        description="View and manage health records for faculty and staff."
      />

      <Card className="shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 min-w-[200px] flex-1"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSearch();
              }}
              placeholder="Search by name or employee number"
              value={query}
            />
            <Button
              className="shrink-0 cursor-pointer"
              disabled={searching || !query.trim()}
              onClick={() => void handleSearch()}
              type="button"
            >
              {searching ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Search className="mr-1 size-3.5" />
              )}
              Search
            </Button>
          </div>

          {searched && results.length === 0 ? (
            <div className="py-10 text-center">
              <User className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No faculty or staff records found. Try a different search term.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee no.</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-[1px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedResults.length > 0 ? (
                      paginatedResults.map((patient) => (
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          key={`${patient.patientType}-${patient.id}`}
                          onClick={() => void loadRecord(patient)}
                        >
                          <TableCell className="font-medium">
                            {patient.first_name} {patient.last_name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {patient.employee_number}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {patient.department ?? "â€”"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className="text-[10px] capitalize"
                              variant="outline"
                            >
                              {patient.patientType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              className="h-7 cursor-pointer text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                void loadRecord(patient);
                              }}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="py-10 text-center" colSpan={5}>
                          <div className="flex flex-col items-center gap-1">
                            <User className="size-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Search for faculty or staff to view their records.
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
                onPageChange={setPage}
                pageSize={PAGE_SIZE}
                totalItems={results.length}
                totalPages={totalPages}
              />
            </>
          )}
        </CardContent>
      </Card>

      {selectedPatient && (
        <div className="flex flex-wrap gap-2">
          <Button
            className="cursor-pointer"
            disabled={loadingRecord}
            size="sm"
            type="button"
          >
            <HeartPulse className="mr-1 size-3.5" />
            {selectedPatient.first_name || "Selected"}{" "}
            {selectedPatient.last_name}
          </Button>
          <Button
            className="cursor-pointer"
            onClick={() => {
              setSelectedPatient(null);
              setFacultyRecord(null);
              setStaffRecord(null);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <RefreshCcw className="mr-1 size-3.5" />
            Clear
          </Button>
        </div>
      )}

      {loadingRecord ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : facultyRecord ? (
        <div className="space-y-6">
          <MedicalRecordView canEdit record={facultyRecord} />
          <StaffRecordExtras
            patientId={facultyRecord.patient_id}
            patientType="faculty"
          />
        </div>
      ) : staffRecord ? (
        <div className="space-y-6">
          <StaffMedicalRecordView record={staffRecord} />
          <StaffRecordExtras
            patientId={staffRecord.profile.id}
            patientType="staff"
          />
        </div>
      ) : selectedPatient ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HeartPulse className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Select a patient above to view their health record.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
