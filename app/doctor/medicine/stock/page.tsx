"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Package } from "lucide-react"
import { toast } from "sonner"
import { getMedicineStock } from "@/actions/clinical/prescriptions"

export default function DoctorMedicineStockPage() {
  const [stock, setStock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMedicineStock()
      if (res.error) {
        toast.error(res.error)
        setStock([])
      } else {
        setStock(res.stock)
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
          ) : stock.length === 0 ? (
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
                    <th className="px-4 py-3 font-medium">Batch</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stock.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{s.medicines?.generic_name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-zinc-600">{s.batch_number || "N/A"}</td>
                      <td className="px-4 py-3 font-semibold">{s.quantity}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : "—"}
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