"use client"

import { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { Search, Users } from "lucide-react"
import { getPatientMedicalRecord, type PatientMedicalRecord } from "@/app/actions/medical-records"
import { SensitiveField } from "@/components/sensitive-field"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const PAGE_SIZE = 10

export default function DoctorPatientsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<PatientMedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const result = await getPatientMedicalRecord("all", "student")
      if (result.error) {
        toast.error(result.error)
        setPatients([])
      } else {
        setPatients(result.records || (result.record ? [result.record] : []))
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load patients")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return patients
    return patients.filter((p) => {
      const haystack = [
        p.first_name, p.last_name, p.identifier, p.department,
        p.course, p.year_level, p.phone, p.email, p.rfid_uid
      ].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [patients, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const getInitials = (p: PatientMedicalRecord) => {
    return `${p.first_name?.[0] || ""}${p.last_name?.[0] || ""}`.toUpperCase()
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Student Patient Records"
        description="View and manage student medical records."
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students by name, ID, course..."
            className="h-9 pl-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500">
              <Search className="size-3.5" />
            </button>
          )}
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
              <Users className="size-7 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No patients found</p>
              <p className="text-xs text-zinc-400">Registered student patients will show up here.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((p) => (
                    <TableRow
                      key={p.patient_id}
                      className="hover:bg-zinc-50/50 cursor-pointer"
                      onClick={() => router.push(`/doctor/patients/${p.patient_id}?type=student`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                            {getInitials(p)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                            <p className="text-xs text-zinc-400 capitalize">{p.patient_type}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600">{p.identifier || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {p.department || "—"}{p.course ? ` • ${p.course}` : ""}{p.year_level ? ` • Year ${p.year_level}` : ""}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600" onClick={(e) => e.stopPropagation()}>
                        {p.email ? (
                          <SensitiveField value={p.email} fieldType="email" />
                        ) : p.phone ? (
                          <SensitiveField value={p.phone} fieldType="phone" />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                          Active
                        </Badge>
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