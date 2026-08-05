"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, Search, Package } from "lucide-react"
import { toast } from "sonner"
import { getInventoryQueue } from "@/actions/inventory/workflow-queries"

export default function AdminMedicineStockPage() {
  const [medicines, setMedicines] = useState<Array<{ id: string; name: string; stock: number; minimum: number; expiry: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

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

  const stockColor = (stock: number, min: number) => {
    if (stock <= 0) return "bg-red-50 text-red-700 border-red-200"
    if (stock <= min) return "bg-amber-50 text-amber-700 border-amber-200"
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  }

  const isExpiringSoon = (expiry: string | null) => {
    if (!expiry) return false
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days <= 90 && days >= 0
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Inventory"
        description="Current stock levels and batch information."
      />

      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicines..." className="h-9 pl-8 text-sm" />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No medicines found.</p>
            </div>
          ) : (
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
                  {filtered.map((m) => (
                    <TableRow key={m.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm font-semibold">{m.stock}</TableCell>
                      <TableCell className="text-sm text-zinc-500">{m.minimum}</TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {m.expiry ? (
                          <span className={isExpiringSoon(m.expiry) ? "text-amber-600 font-medium" : ""}>
                            {new Date(m.expiry).toLocaleDateString()}
                            {isExpiringSoon(m.expiry) && " ⚠"}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${stockColor(m.stock, m.minimum)}`}>
                          {m.stock <= 0 ? "Out of stock" : m.stock <= m.minimum ? "Low stock" : "In stock"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}