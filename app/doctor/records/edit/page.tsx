"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, FileText } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/admin/records"
import { getPatientMedicalRecord, updatePatientMedicalRecord } from "@/actions/clinical/records"

export default function DoctorRecordsEditPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Record<string, any> | null>(null)
  const [record, setRecord] = useState<any>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [saving, setSaving] = useState(false)

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

  async function loadRecord(patient: Record<string, any>) {
    setLoadingRecord(true)
    try {
      const patientType = "student_number" in patient ? "student" : "faculty"
      const res = await getPatientMedicalRecord(patient.id, patientType)
      if (res.error) {
        toast.error(res.error)
        setRecord(null)
      } else {
        setRecord(res.record)
        setSelectedPatient(patient)
      }
    } finally {
      setLoadingRecord(false)
    }
  }

  async function handleSave() {
    if (!record || !selectedPatient) return
    setSaving(true)
    try {
      const patientType = "student_number" in selectedPatient ? "student" : "faculty"
      const res = await updatePatientMedicalRecord(selectedPatient.id, patientType, {
        blood_type: record.blood_type,
        height: record.height,
        weight: record.weight,
        allergies: record.allergies,
        chronic_conditions: record.chronic_conditions,
        current_medications: record.current_medications,
        notes: record.notes,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Medical record updated")
      }
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setRecord((prev: any) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Medical Record" description="Update patient medical information." />

      <Card className="shadow-sm">
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, student number, or employee number"
              className="h-9"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : "Search"}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="divide-y rounded-lg border">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedPatient(r); setResults([]); setQuery(""); loadRecord(r); }}
                  className="w-full text-left p-3 hover:bg-zinc-50/50 transition-colors cursor-pointer"
                >
                  <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                  <p className="text-xs text-zinc-500">{"student_number" in r ? r.student_number : r.employee_number}</p>
                </button>
              ))}
            </div>
          )}

          {selectedPatient && !record && !loadingRecord && (
            <div className="rounded-lg border border-zinc-200 p-3 flex items-center gap-3">
              <div className="size-9 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-600">
                {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                <p className="text-xs text-zinc-500">{"student_number" in selectedPatient ? selectedPatient.student_number : selectedPatient.employee_number}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loadingRecord && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {record && !loadingRecord && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Medical Information</CardTitle>
            <CardDescription className="text-xs">Update the patient's medical record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Blood Type</Label>
                <select
                  value={record.blood_type || ""}
                  onChange={(e) => updateField("blood_type", e.target.value || null)}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
                >
                  <option value="">Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Height (cm)</Label>
                <Input type="number" value={record.height || ""} onChange={(e) => updateField("height", e.target.value ? Number(e.target.value) : null)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Weight (kg)</Label>
                <Input type="number" step="0.1" value={record.weight || ""} onChange={(e) => updateField("weight", e.target.value ? Number(e.target.value) : null)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Allergies</Label>
                <Input value={record.allergies || ""} onChange={(e) => updateField("allergies", e.target.value || null)} placeholder="e.g., Penicillin, Peanuts" className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Chronic Conditions</Label>
              <textarea
                value={record.chronic_conditions || ""}
                onChange={(e) => updateField("chronic_conditions", e.target.value || null)}
                rows={2}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Current Medications</Label>
              <textarea
                value={record.current_medications || ""}
                onChange={(e) => updateField("current_medications", e.target.value || null)}
                rows={2}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <textarea
                value={record.notes || ""}
                onChange={(e) => updateField("notes", e.target.value || null)}
                rows={3}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}