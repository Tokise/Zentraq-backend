"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Package } from "lucide-react"
import { toast } from "sonner"
import { getInventoryQueue } from "@/actions/inventory/workflow-queries"

export default function NurseMedicineStockPage() {
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
        setMedicines(res.medicines)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load medicine stock")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader title="Medicine Stock" description="Current inventory levels." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : medicines.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No medicines in stock.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Medicine</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Min Level</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {medicines.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 font-semibold">{m.stock}</td>
                      <td className="px-4 py-3 text-zinc-500">{m.minimum > 0 ? `Min: ${m.minimum}` : "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {m.expiry ? new Date(m.expiry).toLocaleDateString() : "—"}
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