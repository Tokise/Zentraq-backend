"use client"

import { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { Input } from "@/components/ui/input"
import { Search, Heart, Calendar } from "lucide-react"
import { getHealthPrograms, type HealthProgram } from "@/app/actions/health-programs"
import { toast } from "sonner"

const PAGE_SIZE = 10

export default function AdminServicesProgramsPage() {
  const [programs, setPrograms] = useState<HealthProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchPrograms = async () => {
    setLoading(true)
    try {
      const result = await getHealthPrograms()
      if (result.error) {
        toast.error(result.error)
        setPrograms([])
      } else {
        setPrograms(result.programs || [])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load programs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrograms()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return programs
    return programs.filter((p) => {
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q) || p.program_type.toLowerCase().includes(q)
    })
  }, [programs, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const statusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-700 border-zinc-200">Inactive</Badge>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Health Programs"
        description="Manage clinic health programs and initiatives."
      />

      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search programs..."
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
              <Heart className="size-7 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No health programs</p>
              <p className="text-xs text-zinc-400">Health programs will appear here.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Program</TableHead>
                    <TableHead>Target Audience</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((p) => (
                    <TableRow key={p.id} className="hover:bg-zinc-50/50">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          {p.description && <p className="text-xs text-zinc-400 line-clamp-1">{p.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600 capitalize">{p.program_type || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"} - {p.end_date ? new Date(p.end_date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(p.is_active)}</TableCell>
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