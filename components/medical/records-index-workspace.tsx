"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Filter, Search, UserRound } from "lucide-react"
import { toast } from "sonner"

import {
  getComplianceRecordAction,
  searchPatientProfilesAction,
  type ClinicRole,
  type ComplianceRecordDTO,
  type PatientProfileRole,
  type PatientSearchDTO,
} from "@/actions/clinical/compliance-records"
import { PageHeader } from "@/components/common/page-header"
import { HealthRecordTabs } from "@/components/medical/health-record-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DataTablePagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient as createBrowserClient } from "@/utils/supabase/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface RecordsIndexWorkspaceProps {
  clinicRole: ClinicRole
  scope: "student" | "employee"
}

// Renders a paged clinic index and one selected shared compliance record.
export function RecordsIndexWorkspace({
  clinicRole,
  scope,
}: RecordsIndexWorkspaceProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [supabase] = useState(() => createBrowserClient())
  const [query, setQuery] = useState("")
  const [department, setDepartment] = useState("")
  const [position, setPosition] = useState("")
  const [employeeRole, setEmployeeRole] = useState<"all" | "faculty" | "staff">("all")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<PatientSearchDTO[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PatientSearchDTO | null>(null)
  const [record, setRecord] = useState<ComplianceRecordDTO | null>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)

  // Loads one server-paged set of minimized profiles.
  const loadIndex = useCallback(async () => {
    setLoading(true)
    const result = await searchPatientProfilesAction({
      scope,
      query,
      page,
      department: department || undefined,
      position: scope === "employee" ? position || undefined : undefined,
      patientRole:
        scope === "employee" && employeeRole !== "all"
          ? employeeRole
          : undefined,
    })
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      setRows([])
      setTotal(0)
      setTotalPages(0)
      return
    }
    setRows(result.data)
    setTotal(result.total)
    setTotalPages(result.totalPages)
  }, [department, employeeRole, page, position, query, scope])

  useEffect(() => {
    const indexLoad = window.setTimeout(() => {
      void loadIndex()
    }, 0)
    return () => window.clearTimeout(indexLoad)
  }, [loadIndex])

  // Loads a selected profile's authorized compliance record.
  const loadRecord = useCallback(
    async (patientId: string, patientRole: PatientProfileRole) => {
      setLoadingRecord(true)
      const result = await getComplianceRecordAction({ patientId, patientRole })
      setLoadingRecord(false)
      if (result.error === "SELF_RECORD_REDIRECT") {
        router.replace(`/${clinicRole}/my-health`)
        return
      }
      if (result.error || !result.record) {
        toast.error(result.error ?? "Patient record not found")
        setRecord(null)
        return
      }
      setRecord(result.record)
    },
    [clinicRole, router],
  )

  useEffect(() => {
    const patientId = searchParams.get("id")
    const patientRole = searchParams.get("type")
    const allowed =
      patientRole === "student" ||
      patientRole === "faculty" ||
      patientRole === "staff"
    if (!patientId || !allowed) return
    const recordLoad = window.setTimeout(() => {
      void loadRecord(patientId, patientRole)
    }, 0)
    return () => window.clearTimeout(recordLoad)
  }, [loadRecord, searchParams])

  // Reloads the selected minimized DTO after a private record invalidation.
  useEffect(() => {
    if (!record) return
    let reloadTimer: number | undefined
    const topic = `patient-record:${record.profile.role}:${record.profile.id}`
    const channel = supabase.channel(topic, {
      config: { private: true },
    })
    void supabase.realtime.setAuth().then(() => {
      channel
        .on("broadcast", { event: "patient-record-changed" }, () => {
          window.clearTimeout(reloadTimer)
          reloadTimer = window.setTimeout(() => {
            setPage(1)
            void loadRecord(record.profile.id, record.profile.role)
          }, 100)
        })
        .subscribe()
    })
    return () => {
      window.clearTimeout(reloadTimer)
      void supabase.removeChannel(channel)
    }
  }, [loadRecord, record, supabase])

  // Selects a row and opens its shared record below the index.
  function selectPatient(row: PatientSearchDTO) {
    setSelected(row)
    void loadRecord(row.id, row.role)
  }

  // Applies search filters from the first page.
  function applyFilters() {
    if (page === 1) void loadIndex()
    else setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          scope === "student"
            ? "Search and review Student compliance records."
            : "Search and review Faculty and Staff compliance records."
        }
        title={scope === "student" ? "Student Records" : "Employee Records"}
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_minmax(10rem,0.45fr)_auto]">
            <Input
              aria-label="Search by name or ID"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && applyFilters()}
              placeholder="Search by name or ID"
              value={query}
            />
            <Input
              aria-label="Department filter"
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Department"
              value={department}
            />
            <Button disabled={loading} onClick={applyFilters} type="button">
              <Search className="size-4" />
              Search
            </Button>
          </div>

          {scope === "employee" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
              <Select
                onValueChange={(value) => {
                  setEmployeeRole(value as "all" | "faculty" | "staff")
                  setPage(1)
                }}
                value={employeeRole}
              >
                <SelectTrigger className="w-full">
                  <Filter className="size-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Faculty and Staff</SelectItem>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
              <Input
                aria-label="Position filter"
                onChange={(event) => setPosition(event.target.value)}
                placeholder="Position"
                value={position}
              />
            </div>
          )}

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ID number</TableHead>
                  <TableHead>Department</TableHead>
                  {scope === "employee" && <TableHead>Position</TableHead>}
                  <TableHead>Role</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingRows colSpan={scope === "employee" ? 6 : 5} />
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow key={`${row.role}:${row.id}`}>
                      <TableCell className="font-medium">
                        {row.firstName} {row.lastName}
                      </TableCell>
                      <TableCell>{row.identifier}</TableCell>
                      <TableCell>{row.department ?? "—"}</TableCell>
                      {scope === "employee" && (
                        <TableCell>{row.position ?? "—"}</TableCell>
                      )}
                      <TableCell>
                        <Badge className="capitalize" variant="outline">
                          {row.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => selectPatient(row)}
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
                    <TableCell
                      className="py-12 text-center text-muted-foreground"
                      colSpan={scope === "employee" ? 6 : 5}
                    >
                      <UserRound className="mx-auto mb-2 size-6" />
                      No matching profiles found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            currentPage={page}
            onPageChange={setPage}
            pageSize={10}
            totalItems={total}
            totalPages={totalPages}
          />
        </CardContent>
      </Card>

      {loadingRecord ? (
        <RecordSkeleton />
      ) : record ? (
        <section aria-label="Selected health record" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">
              {record.profile.firstName} {record.profile.lastName}
            </h2>
            {selected && (
              <p className="text-sm text-muted-foreground">
                Selected from the current {scope} results.
              </p>
            )}
          </div>
          <HealthRecordTabs
            capabilities={{
              canAddAllergy: true,
              canAddDocument:
                clinicRole === "admin" || clinicRole === "doctor",
              canAddExam:
                clinicRole === "admin" || clinicRole === "doctor",
              canAddHistory: clinicRole !== "nurse",
              canAddImmunization: true,
              canAddMedication: clinicRole !== "nurse",
              canAddSickLeave: true,
            }}
            onChanged={async () => {
              setPage(1)
              await Promise.all([
                loadRecord(record.profile.id, record.profile.role),
                loadIndex(),
              ])
            }}
            key={record.profile.id}
            readOnly={false}
            record={record}
            role={record.profile.role}
            showPreviousConsultations
          />
        </section>
      ) : null}
    </div>
  )
}

// Renders stable table-row skeletons while a page loads.
function LoadingRows({ colSpan }: { colSpan: number }) {
  return Array.from({ length: 4 }, (_, index) => (
    <TableRow key={index}>
      <TableCell colSpan={colSpan}>
        <Skeleton className="h-8 w-full" />
      </TableCell>
    </TableRow>
  ))
}

// Renders a non-jumping record placeholder while details load.
function RecordSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-52 w-full" />
      </CardContent>
    </Card>
  )
}
