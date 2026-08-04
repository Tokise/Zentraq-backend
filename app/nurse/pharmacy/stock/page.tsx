"use client"

import { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { Input } from "@/components/ui/input"
import { Search, Pill, AlertTriangle } from "lucide-react"
import { getInventoryQueue } from "@/app/actions/workflow-queries"
import { toast } from "sonner"

interface MedicineStock {
  id: string
  name: string
  stock: number
  minimum: number
  expiry: string | null
}

const PAGE_SIZE = 10

export default function NursePharmacyStockPage() {
  const [medicines, setMedicines] = useState<MedicineStock[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchMedicines = async () => {
    setLoading(true)
    try {
      const result = await getInventoryQueue()
      if (result.error) {
        toast.error(result.error)
        setMedicines([])
      } else {
        setMedicines(result.medicines || [])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load inventory")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMedicines()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return medicines
    return medicines.filter((m) => {
      return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    })
  }, [medicines, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const isLowStock = (stock: number, minimum: number) => stock <= minimum

  const isExpired = (expiry: string | null) => {
    if (!expiry) return false
    return new Date(expiry) < new Date()
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Pharmacy Stock"
        description="Monitor medicine inventory and stock levels."
      />

      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medicines..."
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
              <Pill className="size-7 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No medicines in stock</p>
              <p className="text-xs text-zinc-400">Medicine inventory will appear here.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Medicine</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Minimum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((m) => {
                    const low = isLowStock(m.stock, m.minimum)
                    const expired = isExpired(m.expiry)
                    return (
                      <TableRow key={m.id} className="hover:bg-zinc-50/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Pill className="size-3.5 text-zinc-400" />
                            <span className="text-sm font-medium">{m.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600">{m.stock}</TableCell>
                        <TableCell className="text-sm text-zinc-600">{m.minimum}</TableCell>
                        <TableCell>
                          {low && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                              <AlertTriangle className="size-3 mr-1" />
                              Low Stock
                            </Badge>
                          )}
                          {!low && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">OK</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600">
                          {m.expiry ? (
                            <span className={expired ? "text-red-600 font-medium" : ""}>
                              {new Date(m.expiry).toLocaleDateString()}
                              {expired && " (Expired)"}
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
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