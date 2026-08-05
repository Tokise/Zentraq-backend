"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getInventoryQueue } from "@/actions/inventory/workflow-queries"

export default function AdminLowStockAlertsPage() {
  const [medicines, setMedicines] = useState<Array<{ id: string; name: string; stock: number; minimum: number; expiry: string | null }>>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getInventoryQueue()
      if (res.error) {
        toast.error(res.error)
        setMedicines([])
      } else {
        setMedicines(res.medicines.filter((m) => m.stock <= m.minimum))
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Low Stock Alerts"
        description="Medicines at or below their configured minimum stock level."
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : medicines.length === 0 ? (
            <div className="py-16 text-center">
              <AlertTriangle className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All medicines are above their minimum stock level.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Min Level</TableHead>
                    <TableHead>Shortage</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicines.map((m) => (
                    <TableRow key={m.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm font-semibold text-red-600">{m.stock}</TableCell>
                      <TableCell className="text-sm text-zinc-500">{m.minimum}</TableCell>
                      <TableCell className="text-sm text-zinc-600">{m.minimum - m.stock}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${m.stock <= 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {m.stock <= 0 ? "Out of stock" : "Low stock"}
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