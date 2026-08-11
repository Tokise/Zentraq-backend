"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState } from "@/components/common/empty-state"
import { DataTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Package, Search } from "lucide-react"
import { toast } from "sonner"
import {
  getInventoryQueue,
  type InventoryMedicine,
} from "@/actions/inventory/workflow-queries"

type MedicineStatus = "success" | "warning" | "danger" | "default"

export default function NurseMedicineStockPage() {
  const router = useRouter()
  const [medicines, setMedicines] = useState<InventoryMedicine[]>([])
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
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load medicine stock",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchData(), 0)
    return () => window.clearTimeout(initialLoad)
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

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Stock"
        description="Current inventory levels."
      />

      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          className="h-9 pl-8 text-sm"
          onChange={(event) => {
            setSearch(event.target.value)
            setCurrentPage(1)
          }}
          placeholder="Search medicines..."
          value={search}
        />
      </div>

      <div className="border border-border bg-card">
        {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No medicines in stock" description="No inventory items match your search." icon={Package} />
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
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((m) => (
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      key={m.id}
                      onClick={() =>
                        router.push(`/nurse/medicine/restock?medicineId=${m.id}`)
                      }
                    >
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm font-semibold">{m.stock}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.minimum > 0 ? `Min: ${m.minimum}` : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.expiry ? new Date(m.expiry).toLocaleDateString() : "—"}
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
              <DataTablePagination
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
