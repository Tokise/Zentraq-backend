"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Pill } from "lucide-react"
import { toast } from "sonner"
import { getPendingPrescriptions, dispenseMedicine, type Prescription } from "@/actions/clinical/prescriptions"
import { getMedicineStock } from "@/actions/clinical/prescriptions"

export default function NurseMedicineDispensePage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Prescription | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)
  const [stocks, setStocks] = useState<Array<{ id: string; quantity: number; batch_number: string | null; expiry_date: string | null }>>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPendingPrescriptions()
      if (res.error) {
        toast.error(res.error)
        setPrescriptions([])
      } else {
        setPrescriptions(res.prescriptions)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load prescriptions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openDispense = async (p: Prescription) => {
    setSelected(p)
    setQuantities({})
    const stockRes = await getMedicineStock(p.medicine_id)
    if (stockRes.error) {
      toast.error(stockRes.error)
      setStocks([])
    } else {
      setStocks(stockRes.stock)
    }
  }

  const handleDispense = async (stockId: string) => {
    if (!selected) return
    const qty = Number(quantities[stockId])
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity")
      return
    }
    setProcessing(true)
    try {
      const res = await dispenseMedicine(selected.id, stockId, qty)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Medicine dispensed")
        setSelected(null)
        fetchData()
      }
    } finally {
      setProcessing(false)
    }
  }

  const patientName = (p: Prescription) => {
    const visit = p.consultations?.clinic_visits
    if (visit?.students) return `${visit.students.first_name} ${visit.students.last_name} (${visit.students.student_number})`
    if (visit?.faculty) return `${visit.faculty.first_name} ${visit.faculty.last_name} (${visit.faculty.employee_number})`
    return "Unknown"
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dispense Medicine" description="Fulfill pending prescriptions." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="py-16 text-center">
              <Pill className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending prescriptions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Medicine</th>
                    <th className="px-4 py-3 font-medium">Dosage</th>
                    <th className="px-4 py-3 font-medium">Frequency</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prescriptions.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{patientName(p)}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{p.medicines.generic_name}</p>
                          {p.medicines.brand_name && <p className="text-xs text-zinc-400">{p.medicines.brand_name}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{p.dosage || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{p.frequency || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDispense(p)}>
                          Dispense
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispense Medicine</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-sm font-medium">{selected.medicines.generic_name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {patientName(selected)} · {selected.dosage || "No dosage"} {selected.frequency ? `· ${selected.frequency}` : ""}
                </p>
              </div>

              {stocks.length === 0 ? (
                <p className="text-sm text-red-600 py-2 text-center">No stock available for this medicine.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500">Select a batch and quantity:</p>
                  {stocks.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-zinc-200">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Batch {s.batch_number || "N/A"} · {s.quantity} available
                        </p>
                        {s.expiry_date && (
                          <p className="text-xs text-zinc-400">Expires {new Date(s.expiry_date).toLocaleDateString()}</p>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={s.quantity}
                        value={quantities[s.id] || ""}
                        onChange={(e) => setQuantities((q) => ({ ...q, [s.id]: e.target.value }))}
                        placeholder="Qty"
                        className="w-16 h-8 rounded-md border border-zinc-200 px-2 text-sm focus:outline-none"
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => handleDispense(s.id)} disabled={processing || !quantities[s.id]}>
                        {processing ? "..." : "Dispense"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}