"use client"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { Input } from "@/components/ui/input"
import { Search, AlertTriangle, User } from "lucide-react"
import { getIncidentQueue } from "@/app/actions/workflow-queries"
import { useRouter } from "next/navigation"

interface QueueIncident {
  id: string
  description: string
  severity: string | null
  status: string
  created_at: string
}

const PAGE_SIZE = 10

export default function DoctorIncidentsHistoryPage() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<QueueIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [includeClosed, setIncludeClosed] = useState(false)

  const fetchIncidents = async () => {
    setLoading(true)
    try {
      const result = await getIncidentQueue(includeClosed)
      if (result.error) {
        toast.error(result.error)
        setIncidents([])
      } else {
        setIncidents(result.incidents || [])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load incidents")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncidents()
  }, [includeClosed])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return incidents
    return incidents.filter((i) => {
      return i.description.toLowerCase().includes(q) || i.status.toLowerCase().includes(q) || (i.severity || "").toLowerCase().includes(q)
    })
  }, [incidents, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const severityBadge = (severity: string | null) => {
    if (!severity) return null
    const variants: Record<string, string> = {
      low: "bg-blue-50 text-blue-700 border-blue-200",
      medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
      high: "bg-orange-50 text-orange-700 border-orange-200",
      critical: "bg-red-50 text-red-700 border-red-200",
    }
    return <Badge variant="outline" className={`text-[10px] ${variants[severity] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{severity}</Badge>
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      open: "bg-red-50 text-red-700 border-red-200",
      in_progress: "bg-blue-50 text-blue-700 border-blue-200",
      resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      closed: "bg-zinc-50 text-zinc-700 border-zinc-200",
    }
    return <Badge variant="outline" className={`text-[10px] ${variants[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{status.replace("_", " ")}</Badge>
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Incident History"
        description="View and manage incident reports."
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incidents..."
            className="h-9 pl-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500">
              <Search className="size-3.5" />
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeClosed}
            onChange={(e) => setIncludeClosed(e.target.checked)}
            className="rounded border-zinc-300"
          />
          <span className="text-zinc-600">Include closed</span>
        </label>
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
              <AlertTriangle className="size-7 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No incidents found</p>
              <p className="text-xs text-zinc-400">Incident reports will appear here.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Description</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((incident) => (
                    <TableRow
                      key={incident.id}
                      className="hover:bg-zinc-50/50 cursor-pointer"
                      onClick={() => router.push(`/nurse/incidents/${incident.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="size-3.5 text-zinc-400 mt-0.5 shrink-0" />
                          <span className="text-sm line-clamp-2">{incident.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>{severityBadge(incident.severity)}</TableCell>
                      <TableCell>{statusBadge(incident.status)}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {new Date(incident.created_at).toLocaleDateString()}
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