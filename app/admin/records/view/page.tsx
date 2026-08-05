"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { Search, Loader2, User, HeartPulse, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction, type RecordSearchResult } from "@/actions/admin/records"
import { getPatientMedicalRecord, type PatientMedicalRecord } from "@/actions/clinical/records"
import { MedicalRecordView } from "@/components/medical/medical-record-view"
import { RfidSearchButton } from "@/components/rfid-search-button"

export default function AdminMedicalRecordsViewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<RecordSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Array<{ id: string; name: string; type: "student" | "faculty" }>>([])
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  // RFID kiosk scan handler
  async function handleRfidScan(uid: string) {
    setQuery(uid)
    setSearching(true)
    setSearched(true)
    setPage(1)
    try {
      const res = await searchRecordsAction(uid)
      if (res.error) {
        toast.error(res.error)
        setResults([])
      } else {
        const combined = [...res.students, ...res.faculty]
        setResults(combined)
        if (combined.length === 1) {
          const r = combined[0]
          const type = "student_number" in r ? "student" : "faculty"
          selectPatient(r)
        }
      }
    } finally {
      setSearching(false)
    }
  }

  // Auto-load record if id query param is present
  useEffect(() => {
    const id = searchParams.get("id")
    if (!id) return
    const type = searchParams.get("type") as "student" | "faculty" | null
    if (!type) return
    setSelectedPatient([{ id, name: "", type }])
    loadRecord(id, type)
  }, [searchParams])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return results.slice(start, start + pageSize)
  }, [results, page])

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize))

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setSearched(true)
    setPage(1)
    try {
      const res = await searchRecordsAction(query)
      if (res.error) {
        toast.error(res.error)
        setResults([])
      } else {
        setResults([...res.students, ...res.faculty])
      }
    } finally {
      setSearching(false)
    }
  }

  const loadRecord = useCallback(async (patientId: string, patientType: "student" | "faculty") => {
    setLoadingRecord(true)
    setRecord(null)
    try {
      const res = await getPatientMedicalRecord(patientId, patientType)
      if (res.error) {
        toast.error(res.error)
      } else if (res.record) {
        setRecord(res.record)
      } else {
        toast.error("No medical record found for this patient")
      }
    } finally {
      setLoadingRecord(false)
    }
  }, [])

  function selectPatient(r: RecordSearchResult) {
    const type = "student_number" in r ? "student" : "faculty"
    const name = `${r.first_name} ${r.last_name}`
    setSelectedPatient((prev) => {
      if (prev.some((p) => p.id === r.id)) return prev
      return [...prev, { id: r.id, name, type }]
    })
    loadRecord(r.id, type)
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
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Search className="size-3.5 mr-1" />}
              Search
            </Button>
            <RfidSearchButton onResults={(results) => {
              setResults(results)
              setSearched(true)
              setPage(1)
              if (results.length === 1) {
                selectPatient(results[0])
              }
            }} />
          </div>

          {searched && results.length === 0 ? (
            <div className="py-10 text-center">
              <User className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No patients found. Try a different search term.</p>
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
                        const patientType = "student_number" in r ? "student" : "faculty"
                        return (
                          <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => selectPatient(r)}>
                            <TableCell className="font-medium">{r.first_name} {r.last_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {"student_number" in r ? r.student_number : r.employee_number}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.department ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] capitalize">{patientType}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="h-7 text-xs cursor-pointer">View</Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <User className="size-8 text-zinc-300" />
                            <p className="text-sm text-muted-foreground">Search for patients to view their medical records</p>
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
              variant={record && p.id === record.patient_id ? "default" : "outline"}
              size="sm"
              onClick={() => loadRecord(p.id, p.type)}
              disabled={loadingRecord}
              className="cursor-pointer"
            >
              <HeartPulse className="size-3.5 mr-1" />
              {p.name}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => { setSelectedPatient([]); setRecord(null) }} className="cursor-pointer">
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
        <MedicalRecordView record={record} canEdit={true} />
      ) : selectedPatient.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HeartPulse className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Select a patient above to view their medical record.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
