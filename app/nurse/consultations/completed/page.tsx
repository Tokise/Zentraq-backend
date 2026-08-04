"use client"

import { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { Input } from "@/components/ui/input"
import { Search, Stethoscope, User } from "lucide-react"
import { getConsultationQueue } from "@/app/actions/workflow-queries"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface QueueConsultation {
  id: string
  patient_name: string
  complaint: string
  status: string
  check_in_time: string
  doctor_name: string | null
}

const PAGE_SIZE = 10

export default function NurseConsultationsCompletedPage() {
  const router = useRouter()
  const [consultations, setConsultations] = useState<QueueConsultation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchConsultations = async () => {
    setLoading(true)
    try {
      const result = await getConsultationQueue(["completed", "cancelled"])
      if (result.error) {
        toast.error(result.error)
        setConsultations([])
      } else {
        setConsultations(result.consultations || [])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load consultations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConsultations()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return consultations
    return consultations.filter((c) => {
      return c.patient_name.toLowerCase().includes(q) || c.complaint.toLowerCase().includes(q) || c.status.toLowerCase().includes(q)
    })
  }, [consultations, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    }
    return <Badge variant="outline" className={`text-[10px] ${variants[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{status}</Badge>
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Completed Consultations"
        description="View past consultation records."
      />

      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients..."
          className="h-9 pl-8 text-sm"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500">
            <Search className="size-3.5" />
          </button>
        )}
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
              <Stethoscope className="size-7 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No completed consultations</p>
              <p className="text-xs text-zinc-400">Completed consultations will appear here.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Patient</TableHead>
                    <TableHead>Complaint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Checked In</TableHead>
                    <TableHead>Doctor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((c) => (
                    <TableRow
                      key={c.id}
                      className="hover:bg-zinc-50/50 cursor-pointer"
                      onClick={() => router.push(`/nurse/consultations/${c.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="size-3.5 text-zinc-400" />
                          <span className="text-sm font-medium">{c.patient_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600">{c.complaint || "—"}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {new Date(c.check_in_time).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {c.doctor_name || "Unassigned"}
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