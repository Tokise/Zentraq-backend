"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Stethoscope, Save } from "lucide-react"
import { toast } from "sonner"
import { getConsultationQueue } from "@/actions/inventory/workflow-queries"
import { getConsultationDetailAction, updateConsultationNotesAction } from "@/actions/admin/visits-admin"

export default function NurseVisitNotesPage() {
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [notes, setNotes] = useState("")
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)

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
        setNotes(res.consultation?.consultation_notes || "")
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await updateConsultationNotesAction(selected.id, notes)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Notes saved")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Consultation Notes" description="View and edit consultation notes." />

      <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <Card className="shadow-sm h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Consultations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : consultations.length === 0 ? (
              <div className="py-10 text-center">
                <Stethoscope className="size-6 text-zinc-300 mx-auto" />
              </div>
            ) : (
              <div className="divide-y">
                {consultations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openDetail(c.id)}
                    className={`w-full text-left p-3 hover:bg-zinc-50/50 transition-colors cursor-pointer ${
                      selected?.id === c.id ? "bg-zinc-50" : ""
                    }`}
                  >
                    <p className="text-sm font-medium">{c.patient_name}</p>
                    <p className="text-xs text-zinc-500 truncate">{c.complaint || "No complaint"}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(c.check_in_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Notes Editor</CardTitle>
                <CardDescription className="text-xs">
                  {selected ? selected.patient_name : "Select a consultation"}
                </CardDescription>
              </div>
              {selected && (
                <Badge variant="outline" className="text-[10px] capitalize">{selected.status}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : selected ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-200 p-3 text-sm">
                  <p className="text-xs text-zinc-500 mb-1 font-medium">Chief Complaint</p>
                  <p>{selected.chief_complaint || "—"}</p>
                  {selected.doctor_name && (
                    <p className="text-xs text-zinc-400 mt-2">Doctor: {selected.doctor_name}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Consultation Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={12}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none"
                  />
                </div>
                <Button onClick={handleSaveNotes} disabled={saving} className="cursor-pointer">
                  {saving ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Saving...</> : <><Save className="size-3.5 mr-1" /> Save Notes</>}
                </Button>
              </div>
            ) : (
              <div className="py-10 text-center">
                <Stethoscope className="size-6 text-zinc-300 mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}