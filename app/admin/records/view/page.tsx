"use client"

import { useState, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, User, HeartPulse } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/admin/records"
import { getPatientMedicalRecord, type PatientMedicalRecord } from "@/actions/clinical/records"
import { MedicalRecordView } from "@/components/medical/medical-record-view"

export default function AdminMedicalRecordsViewPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Array<{ id: string; name: string; type: "student" | "faculty" }>>([])
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)

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

  const loadRecord = useCallback(async (patientId: string, patientType: "student" | "faculty") => {
    setLoadingRecord(true)
    setRecord(null)
    try {
      const res = await getPatientMedicalRecord(patientId, patientType)
      if (res.error) {
        toast.error(res.error)
      } else if (res.record) {
        setRecord(res.record)
      } else {
        toast.error("No medical record found for this patient")
      }
    } finally {
      setLoadingRecord(false)
    }
  }, [])

  function selectPatient(r: Record<string, any>) {
    const type = "student_number" in r ? "student" : "faculty"
    const name = `${r.first_name} ${r.last_name}`
    setResults([])
    setQuery("")
    setSelectedPatient((prev) => {
      if (prev.some((p) => p.id === r.id)) return prev
      return [...prev, { id: r.id, name, type }]
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Records"
        description="View complete medical records for students and faculty."
      />

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, student number, or employee number"
              className="h-9"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Search className="size-3.5 mr-1" />}
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="mt-3 divide-y rounded-lg border max-h-72 overflow-y-auto">
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

          {selectedPatient.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedPatient.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 py-1 pl-3 pr-1">
                  <span className="text-xs font-medium">{p.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{p.type}</Badge>
                  <button
                    onClick={() => {
                      setSelectedPatient((prev) => prev.filter((x) => x.id !== p.id))
                      setRecord(null)
                    }}
                    className="size-5 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPatient.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {selectedPatient.map((p) => (
            <Button
              key={p.id}
              variant={record && p.id === record.patient_id ? "default" : "outline"}
              size="sm"
              onClick={() => loadRecord(p.id, p.type)}
              disabled={loadingRecord}
              className="cursor-pointer"
            >
              <HeartPulse className="size-3.5 mr-1" />
              {p.name}
            </Button>
          ))}
        </div>
      )}

      {loadingRecord ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : record ? (
        <MedicalRecordView record={record} canEdit={true} />
      ) : selectedPatient.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HeartPulse className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Select a patient above to view their medical record.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}