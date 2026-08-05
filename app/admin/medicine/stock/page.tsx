"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, Search, Package } from "lucide-react"
import { toast } from "sonner"
import { getInventoryQueue } from "@/actions/inventory/workflow-queries"

type MedicineStatus = "success" | "warning" | "danger" | "default"

export default function AdminMedicineStockPage() {
  const router = useRouter()
  const [medicines, setMedicines] = useState<Array<{ id: string; name: string; stock: number; minimum: number; expiry: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getInventoryQueue()
      if (res.error) {
        toast.error(res.error)
        setMedicines([])
      } else {
        setMedicines(res.medicines)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load inventory")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return medicines
    return medicines.filter((m) => m.name.toLowerCase().includes(q))
  }, [medicines, search])

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const getStockStatus = (stock: number, min: number): { variant: MedicineStatus; label: string } => {
    if (stock <= 0) return { variant: "danger", label: "Out of Stock" }
    if (stock <= min) return { variant: "warning", label: "Low Stock" }
    return { variant: "success", label: "In Stock" }
  }

  const isExpiringSoon = (expiry: string | null) => {
    if (!expiry) return false
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days <= 90 && days >= 0
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Inventory"
        description="Current stock levels and batch information."
      />

      {/* Search */}
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicines..." className="h-9 pl-8 text-sm" />
      </div>

      {/* Table */}
      <div className="border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No medicines found"
              description="No inventory items match your search."
              icon={Package}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Min Level</TableHead>
                    <TableHead>Nearest Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((m) => (
                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/medicine/restock`)}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm font-semibold">{m.stock}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.minimum}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.expiry ? (
                          <span className={isExpiringSoon(m.expiry) ? "text-warning font-medium" : ""}>
                            {new Date(m.expiry).toLocaleDateString()}
                            {isExpiringSoon(m.expiry) && " ⚠"}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={getStockStatus(m.stock, m.minimum).variant}>
                          {getStockStatus(m.stock, m.minimum).label}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="p-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}