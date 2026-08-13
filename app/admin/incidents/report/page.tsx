"use client"

import { useState } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, User, AlertTriangle, Activity, HeartPulse, MapPin } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/clinical/records/search"
import { reportIncidentAction } from "@/actions/clinical/incidents/management"

export default function AdminIncidentReportPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Record<string, any> | null>(null)

  const [incidentType, setIncidentType] = useState<"injury" | "illness" | "emergency" | null>(null)
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [severity, setSeverity] = useState<"minor" | "moderate" | "severe" | "critical">("moderate")
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

  function patientType(record: Record<string, any>): "student" | "faculty" {
    return "student_number" in record ? "student" : "faculty"
  }

  async function handleSubmit() {
    if (!selected) {
      toast.error("Please select a patient")
      return
    }
    if (!incidentType) {
      toast.error("Please select an incident type")
      return
    }
    if (!description.trim()) {
      toast.error("Please describe the incident")
      return
    }

    setSubmitting(true)
    try {
      const res = await reportIncidentAction({
        patient_type: patientType(selected),
        patient_id: selected.id,
        incident_type: incidentType,
        description,
        location: location || undefined,
        severity,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Incident reported")
        setSelected(null)
        setIncidentType(null)
        setDescription("")
        setLocation("")
        setSeverity("moderate")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const incidentTypes = [
    { value: "injury" as const, label: "Injury", icon: AlertTriangle, color: "text-orange-600" },
    { value: "illness" as const, label: "Illness", icon: Activity, color: "text-blue-600" },
    { value: "emergency" as const, label: "Emergency", icon: HeartPulse, color: "text-red-600" },
  ]

  const severityOptions = [
    { value: "minor" as const, label: "Minor", color: "bg-green-100 text-green-800" },
    { value: "moderate" as const, label: "Moderate", color: "bg-yellow-100 text-yellow-800" },
    { value: "severe" as const, label: "Severe", color: "bg-orange-100 text-orange-800" },
    { value: "critical" as const, label: "Critical", color: "bg-red-100 text-red-800" },
  ]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Report Incident"
        description="Record a new incident case for a student or faculty member."
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
                  onClick={() => { setSelected(r); setResults([]); setQuery("") }}
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

          {selected && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
              <User className="size-4 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">{selected.first_name} {selected.last_name}</p>
                <p className="text-xs text-emerald-600">
                  {"student_number" in selected ? selected.student_number : selected.employee_number}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelected(null)}>Change</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Incident Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Incident Type *</Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {incidentTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setIncidentType(type.value)}
                  className={`border rounded-lg p-4 text-left transition-colors cursor-pointer ${
                    incidentType === type.value ? "bg-accent border-primary" : "hover:bg-accent"
                  }`}
                >
                  <type.icon className={`h-5 w-5 ${type.color} mb-1`} />
                  <span className="font-medium text-sm">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description *</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what happened, when, and any relevant details..."
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Gym, Classroom 101" className="h-9 pl-9" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Severity Level</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {severityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSeverity(option.value)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
                    severity === option.value ? option.color : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full cursor-pointer">
            {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Reporting...</> : "Report Incident"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}