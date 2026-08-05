"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Search, Loader2, User, Activity } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/admin/records"
import { createTriageAssessment } from "@/actions/clinical/visits"
import { getConsultationQueue } from "@/actions/inventory/workflow-queries"

export default function AdminVisitVitalsPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
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

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await getConsultationQueue()
      if (res.error) {
        toast.error(res.error)
        setResults([])
      } else {
        const q = query.trim().toLowerCase()
        setResults(res.consultations.filter((c: any) =>
          c.patient_name.toLowerCase().includes(q) || c.complaint.toLowerCase().includes(q)
        ))
      }
    } finally {
      setSearching(false)
    }
  }

  async function handleSubmit() {
    if (!selected) {
      toast.error("Please select a consultation")
      return
    }
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
    } catch (err: any) {
      toast.error(err.message || "Failed to record vitals")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Record Vitals"
        description="Record triage vital signs for a consultation."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Select Consultation</CardTitle>
          <CardDescription className="text-xs">Search by patient name or complaint.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Patient name or complaint"
              className="h-9"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Search className="size-3.5 mr-1" />}
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="divide-y rounded-lg border max-h-72 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setResults([]); setQuery("") }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50/50 transition-colors text-left cursor-pointer"
                >
                  <Activity className="size-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.patient_name}</p>
                    <p className="text-xs text-zinc-500 truncate">{c.complaint || "No complaint"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
              <Activity className="size-4 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">{selected.patient_name}</p>
                <p className="text-xs text-emerald-600">{selected.complaint}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelected(null)}>Change</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Vital Signs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Saving...</> : "Save Vitals"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}