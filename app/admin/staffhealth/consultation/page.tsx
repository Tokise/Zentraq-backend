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

export default function AdminStaffHealthConsultationPage() {
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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      "in-progress": "bg-amber-50 text-amber-700 border-amber-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    }
    return (
      <Badge variant="outline" className={`text-[10px] ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Consultations"
        description="Consultation history for faculty members."
      />

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
                    <th className="px-4 py-3 font-medium">Doctor</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {consultations.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.patient_name}</td>
                      <td className="px-4 py-3 max-w-[250px] truncate">{c.complaint || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{c.doctor_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(c.check_in_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(c.id)}>
                          View
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
            <DialogTitle>Consultation Detail</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{selected.patient_name}</p>
                  {statusBadge(selected.status)}
                </div>
                {selected.chief_complaint && (
                  <p className="text-sm"><span className="font-medium">Complaint:</span> {selected.chief_complaint}</p>
                )}
                {selected.doctor_name && <p className="text-xs text-zinc-500">Doctor: {selected.doctor_name}</p>}
                {selected.consultation_notes && (
                  <p className="text-sm text-zinc-600 whitespace-pre-wrap">{selected.consultation_notes}</p>
                )}
              </div>

              {selected.triage && (
                <div className="rounded-lg bg-zinc-50 p-4">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Triage Vitals</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {selected.triage.temperature !== null && <div><span className="text-zinc-400">Temp:</span> {selected.triage.temperature}°C</div>}
                    {selected.triage.blood_pressure && <div><span className="text-zinc-400">BP:</span> {selected.triage.blood_pressure}</div>}
                    {selected.triage.heart_rate !== null && <div><span className="text-zinc-400">HR:</span> {selected.triage.heart_rate}</div>}
                    {selected.triage.oxygen_saturation !== null && <div><span className="text-zinc-400">SpO2:</span> {selected.triage.oxygen_saturation}%</div>}
                  </div>
                  {selected.triage.triage_level && (
                    <p className="text-xs mt-2 text-zinc-500">Level: <Badge variant="outline" className="text-[10px] capitalize">{selected.triage.triage_level}</Badge></p>
                  )}
                </div>
              )}

              {selected.diagnoses.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Diagnoses</p>
                  <div className="space-y-1">
                    {selected.diagnoses.map((d: any) => (
                      <div key={d.id} className="text-sm flex items-center gap-2">
                        {d.icd10_code && <Badge variant="outline" className="text-[10px] font-mono">{d.icd10_code}</Badge>}
                        <span>{d.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.prescriptions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Prescriptions</p>
                  <div className="space-y-1">
                    {selected.prescriptions.map((p: any) => (
                      <div key={p.id} className="text-sm">
                        <span className="font-medium">{p.medicine_name}</span>
                        {p.dosage && <span> · {p.dosage}</span>}
                        <Badge variant="outline" className="text-[10px] ml-2 capitalize">{p.status}</Badge>
                      </div>
                    ))}
                  </div>
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