"use client"

import { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { Search, Pill, Calendar, User } from "lucide-react"
import { getPrescriptionHistory, type Prescription } from "@/app/actions/prescriptions"
import { toast } from "sonner"

type PatientType = "student" | "faculty"

const PAGE_SIZE = 10

export default function DoctorPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [patientType, setPatientType] = useState<PatientType>("student")

  const fetchPrescriptions = async () => {
    setLoading(true)
    try {
      const result = await getPrescriptionHistory("all", patientType)
      if (result.error) {
        toast.error(result.error)
        setPrescriptions([])
      } else {
        setPrescriptions(result.prescriptions || [])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load prescriptions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrescriptions()
  }, [patientType])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return prescriptions
    return prescriptions.filter((p) => {
      const patient = p.consultations?.clinic_visits?.students || p.consultations?.clinic_visits?.faculty
      const patientName = patient ? `${patient.first_name} ${patient.last_name}`.toLowerCase() : ""
      const medicine = `${p.medicines?.generic_name} ${p.medicines?.brand_name || ""}`.toLowerCase()
      return patientName.includes(q) || medicine.includes(q) || p.status.toLowerCase().includes(q)
    })
  }, [prescriptions, search])

  useEffect(() => {
    setPage(1)
  }, [search, patientType])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const getPatientLabel = (p: Prescription) => {
    const patient = p.consultations?.clinic_visits?.students || p.consultations?.clinic_visits?.faculty
    if (!patient) return "Unknown"
    if ("student_number" in patient) return `${patient.first_name} ${patient.last_name} (${patient.student_number})`
    return `${patient.first_name} ${patient.last_name} (${patient.employee_number})`
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
      dispensed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    }
    return (
      <Badge variant="outline" className={`text-[10px] ${variants[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Prescription History"
        description="View and track patient prescriptions."
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient or medicine..."
            className="h-9 pl-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500">
              <Search className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(["student", "faculty"] as PatientType[]).map((type) => (
            <button
              key={type}
              onClick={() => setPatientType(type)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors capitalize ${patientType === type ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="size-9 rounded-full bg-zinc-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-zinc-100 rounded" />
                    <div className="h-2.5 w-24 bg-zinc-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-1.5">
              <Pill className="size-7 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No prescriptions found</p>
              <p className="text-xs text-zinc-400">Prescriptions will appear here after consultations.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Patient</TableHead>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((p) => (
                    <TableRow key={p.id} className="hover:bg-zinc-50/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="size-3.5 text-zinc-400" />
                          <span className="text-sm">{getPatientLabel(p)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{p.medicines?.generic_name}</p>
                          {p.medicines?.brand_name && <p className="text-xs text-zinc-400">{p.medicines.brand_name}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {p.dosage || "—"} {p.frequency ? `• ${p.frequency}` : ""}
                      </TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {p.consultations?.created_at ? new Date(p.consultations.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!loading && filtered.length > 0 && (
                <div className="px-4 py-3 border-t border-zinc-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filtered.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}