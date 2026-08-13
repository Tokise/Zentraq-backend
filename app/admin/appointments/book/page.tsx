"use client"

import { useState } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Search, CalendarPlus, Loader2, User } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/clinical/records/search"
import { createAdminAppointmentAction } from "@/actions/appointments/scheduling"

// Creates an appointment on behalf of an authorized patient.
export default function AdminBookAppointmentPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Record<string, any> | null>(null)

  const [form, setForm] = useState({
    reason: "",
    symptoms: "",
    scheduledDate: "",
    scheduledTime: "",
    priority: "",
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await searchRecordsAction(query)
      if (res.error) {
        toast.error(res.error)
        setResults([])
      } else {
        setResults([...res.students, ...res.faculty])
      }
    } finally {
      setSearching(false)
    }
  }

  function selectPatient(record: Record<string, any>) {
    setSelected(record)
    setResults([])
    setQuery("")
  }

  function patientType(record: Record<string, any>): "student" | "faculty" {
    return "student_number" in record ? "student" : "faculty"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) {
      toast.error("Please select a patient first")
      return
    }
    if (!form.reason.trim()) {
      toast.error("Reason is required")
      return
    }

    setSubmitting(true)
    try {
      const res = await createAdminAppointmentAction({
        patientType: patientType(selected),
        patientId: selected.id,
        reason: form.reason,
        symptoms: form.symptoms || undefined,
        scheduledDate: form.scheduledDate || undefined,
        scheduledTime: form.scheduledTime || undefined,
        priority: form.priority ? Number(form.priority) : undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Appointment created")
        setSelected(null)
        setForm({ reason: "", symptoms: "", scheduledDate: "", scheduledTime: "", priority: "" })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Book Appointment"
        description="Create an appointment on behalf of a student or faculty member."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Select Patient</CardTitle>
          <CardDescription className="text-xs">Search by name, student number, or employee number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Name, student number, or employee number"
              className="h-9"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Search className="size-3.5 mr-1" />}
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="divide-y rounded-lg border max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectPatient(r)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50/50 transition-colors text-left cursor-pointer"
                >
                  <User className="size-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                    <p className="text-xs text-zinc-500">
                      {"student_number" in r ? r.student_number : r.employee_number} · {r.department || "No department"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {"student_number" in r ? "Student" : "Faculty"}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {selected ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
              <User className="size-4 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">{selected.first_name} {selected.last_name}</p>
                <p className="text-xs text-emerald-600">
                  {"student_number" in selected ? selected.student_number : selected.employee_number}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelected(null)}>
                Change
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Appointment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Reason <span className="text-red-500">*</span></Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Annual physical, headache" className="h-9" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Symptoms</Label>
              <textarea
                value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                rows={3}
                placeholder="Describe symptoms (optional)"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Preferred Date</Label>
                <Calendar
                  className="h-9"
                  onSelect={(scheduledDate) =>
                    setForm((current) => ({ ...current, scheduledDate }))
                  }
                  selected={form.scheduledDate}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preferred Time</Label>
                <Input type="time" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority (1-5, optional)</Label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
              >
                <option value="">No priority override</option>
                <option value="1">1 - Low</option>
                <option value="2">2</option>
                <option value="3">3 - Normal</option>
                <option value="4">4</option>
                <option value="5">5 - High</option>
              </select>
            </div>

            <Button type="submit" disabled={submitting || !selected} className="cursor-pointer">
              {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Creating...</> : <><CalendarPlus className="size-3.5 mr-1" /> Create Appointment</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
