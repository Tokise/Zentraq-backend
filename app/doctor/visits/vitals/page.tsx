"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Activity, Search } from "lucide-react"
import { toast } from "sonner"
import { getConsultationQueue } from "@/actions/inventory/workflow-queries"
import { createTriageAssessment } from "@/actions/clinical/visits"

export default function DoctorVisitVitalsPage() {
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({
    temperature: "",
    blood_pressure: "",
    heart_rate: "",
    respiratory_rate: "",
    oxygen_saturation: "",
    weight: "",
    height: "",
    symptoms: "",
    triage_level: "",
    notes: "",
  })
  const [submitting, setSubmitting] = useState(false)

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

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await createTriageAssessment({
        consultation_id: selected.id,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        blood_pressure: form.blood_pressure || undefined,
        heart_rate: form.heart_rate ? Number(form.heart_rate) : undefined,
        respiratory_rate: form.respiratory_rate ? Number(form.respiratory_rate) : undefined,
        oxygen_saturation: form.oxygen_saturation ? Number(form.oxygen_saturation) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        height: form.height ? Number(form.height) : undefined,
        symptoms: form.symptoms || undefined,
        triage_level: form.triage_level || undefined,
        notes: form.notes || undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Vitals recorded")
        setSelected(null)
        setForm({ temperature: "", blood_pressure: "", heart_rate: "", respiratory_rate: "", oxygen_saturation: "", weight: "", height: "", symptoms: "", triage_level: "", notes: "" })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Record Vitals" description="Record patient vital signs." />

      <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <Card className="shadow-sm h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Consultations</CardTitle>
            <CardDescription className="text-xs">Select a patient to record vitals.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : consultations.length === 0 ? (
              <div className="py-10 text-center">
                <Activity className="size-6 text-zinc-300 mx-auto" />
              </div>
            ) : (
              <div className="divide-y">
                {consultations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
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
            <CardTitle className="text-base">Vital Signs</CardTitle>
            <CardDescription className="text-xs">{selected ? selected.patient_name : "Select a consultation"}</CardDescription>
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Temperature (°C)</Label>
                    <Input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Blood Pressure</Label>
                    <Input value={form.blood_pressure} onChange={(e) => setForm({ ...form, blood_pressure: e.target.value })} placeholder="120/80" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Heart Rate</Label>
                    <Input type="number" value={form.heart_rate} onChange={(e) => setForm({ ...form, heart_rate: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Resp. Rate</Label>
                    <Input type="number" value={form.respiratory_rate} onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">SpO2 (%)</Label>
                    <Input type="number" value={form.oxygen_saturation} onChange={(e) => setForm({ ...form, oxygen_saturation: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="h-9" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Triage Level</Label>
                  <select
                    value={form.triage_level}
                    onChange={(e) => setForm({ ...form, triage_level: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
                  >
                    <option value="">No triage level</option>
                    <option value="red">Red - Emergency</option>
                    <option value="yellow">Yellow - Urgent</option>
                    <option value="green">Green - Non-urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Symptoms</Label>
                  <textarea
                    value={form.symptoms}
                    onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none resize-none"
                  />
                </div>

                <Button onClick={handleSubmit} disabled={submitting} className="w-full cursor-pointer">
                  {submitting ? "Saving..." : "Save Vitals"}
                </Button>
              </div>
            ) : (
              <div className="py-10 text-center">
                <Activity className="size-6 text-zinc-300 mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}