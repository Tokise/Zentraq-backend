"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Stethoscope } from "lucide-react"
import { toast } from "sonner"
import { getConsultationQueue } from "@/actions/inventory/workflow-queries"
import { getConsultationDetailAction } from "@/actions/admin/visits-admin"

export default function DoctorVisitPrescriptionPage() {
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getConsultationQueue()
      if (res.error) {
        toast.error(res.error)
        setConsultations([])
      } else {
        setConsultations(res.consultations)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load consultations")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openDetail = async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await getConsultationDetailAction(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        setSelected(res.consultation)
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Prescriptions" description="View prescriptions issued during consultations." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : consultations.length === 0 ? (
            <div className="py-16 text-center">
              <Stethoscope className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No consultations found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Complaint</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {consultations.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.patient_name}</td>
                      <td className="px-4 py-3 max-w-[250px] truncate">{c.complaint || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(c.check_in_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(c.id)}>
                          View Prescriptions
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
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescriptions</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-4">
                <p className="text-sm font-medium">{selected.patient_name}</p>
                <p className="text-xs text-zinc-500 mt-1">{selected.chief_complaint || "No complaint"}</p>
              </div>

              {selected.prescriptions.length > 0 ? (
                <div className="space-y-2">
                  {selected.prescriptions.map((p: any) => (
                    <div key={p.id} className="rounded-lg bg-zinc-50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{p.medicine_name}</p>
                        <Badge variant="outline" className="text-[10px] capitalize">{p.status}</Badge>
                      </div>
                      {p.dosage && <p className="text-xs text-zinc-600 mt-1">Dosage: {p.dosage}</p>}
                      {p.frequency && <p className="text-xs text-zinc-600">Frequency: {p.frequency}</p>}
                      {p.quantity !== null && <p className="text-xs text-zinc-600">Quantity: {p.quantity}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 text-center py-4">No prescriptions issued for this consultation.</p>
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