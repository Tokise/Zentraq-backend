"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getInventoryQueue } from "@/actions/inventory/workflow-queries"

export default function NurseLowStockAlertsPage() {
  const [medicines, setMedicines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getInventoryQueue()
      if (res.error) {
        toast.error(res.error)
        setMedicines([])
      } else {
        const lowStock = (res.medicines || []).filter((m: any) => m.stock <= m.minimum)
        setMedicines(lowStock)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load medicines")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader title="Low Stock Alerts" description="Medicines that need restocking." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : medicines.length === 0 ? (
            <div className="py-16 text-center">
              <AlertTriangle className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No low stock alerts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Medicine</th>
                    <th className="px-4 py-3 font-medium">Current Stock</th>
                    <th className="px-4 py-3 font-medium">Min Level</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {medicines.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 font-semibold">{m.stock}</td>
                      <td className="px-4 py-3 text-zinc-500">{m.minimum}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${m.stock === 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {m.stock === 0 ? "Out of Stock" : "Low Stock"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}