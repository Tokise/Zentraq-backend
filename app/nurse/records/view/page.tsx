"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, FileText, Search } from "lucide-react"
import { toast } from "sonner"
import { getPatientMedicalRecord } from "@/actions/clinical/records"
import { searchRecordsAction } from "@/actions/admin/records"
import { getConsultationDetailAction } from "@/actions/admin/visits-admin"

export default function NurseRecordsViewPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Record<string, any> | null>(null)
  const [record, setRecord] = useState<any>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<any>(null)
  const [visitDetail, setVisitDetail] = useState<any>(null)

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
        setSelectedVisit(null)
        setVisitDetail(null)
      }
    } finally {
      setLoadingRecord(false)
    }
  }

  async function openVisitDetail(visitId: string) {
    const res = await getConsultationDetailAction(visitId)
    if (res.error) {
      toast.error(res.error)
    } else {
      setVisitDetail(res.consultation)
      setSelectedVisit(visitId)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Medical Records" description="View patient medical records and visit history." />

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
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Search className="size-3.5 mr-1" />}
              Search
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

          {selectedPatient && (
            <div className="rounded-lg border border-zinc-200 p-3 flex items-center gap-3">
              <div className="size-9 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-600">
                {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                <p className="text-xs text-zinc-500">{"student_number" in selectedPatient ? selectedPatient.student_number : selectedPatient.employee_number}</p>
              </div>
              <div className="ml-auto">
                <Badge variant="outline" className="text-[10px] capitalize">{"student_number" in selectedPatient ? "Student" : "Faculty"}</Badge>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">Blood Type</p>
                  <p className="font-medium">{record.blood_type || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Height</p>
                  <p className="font-medium">{record.height ? `${record.height} cm` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Weight</p>
                  <p className="font-medium">{record.weight ? `${record.weight} kg` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Allergies</p>
                  <p className="font-medium">{record.allergies || "None"}</p>
                </div>
              </div>
              {record.chronic_conditions && (
                <div>
                  <p className="text-xs text-zinc-500">Chronic Conditions</p>
                  <p className="text-sm">{record.chronic_conditions}</p>
                </div>
              )}
              {record.current_medications && (
                <div>
                  <p className="text-xs text-zinc-500">Current Medications</p>
                  <p className="text-sm">{record.current_medications}</p>
                </div>
              )}
              {record.notes && (
                <div>
                  <p className="text-xs text-zinc-500">Notes</p>
                  <p className="text-sm">{record.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Immunizations</h3>
              {record.immunizations && record.immunizations.length > 0 ? (
                <div className="space-y-2">
                  {record.immunizations.map((imm: any) => (
                    <div key={imm.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{imm.vaccine_name}</p>
                        <p className="text-xs text-zinc-500">{imm.vaccine_type} · Dose {imm.dose_number}</p>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {new Date(imm.administered_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No immunization records.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {record && !loadingRecord && (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Visit History</h3>
            </div>
            {record.visits && record.visits.length > 0 ? (
              <div className="divide-y">
                {record.visits.map((visit: any) => (
                  <button
                    key={visit.id}
                    onClick={() => openVisitDetail(visit.id)}
                    className={`w-full text-left p-3 hover:bg-zinc-50/50 transition-colors cursor-pointer ${selectedVisit === visit.id ? "bg-zinc-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(visit.check_in_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        <p className="text-xs text-zinc-500">{visit.visit_type} · {visit.status}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">{visit.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-zinc-400">No visits recorded.</div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!visitDetail} onOpenChange={() => { setSelectedVisit(null); setVisitDetail(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visit Details</DialogTitle>
          </DialogHeader>
          {visitDetail && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-sm font-medium">{visitDetail.patient_name}</p>
                <p className="text-xs text-zinc-500">{visitDetail.chief_complaint || "No complaint"}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {new Date(visitDetail.check_in_time).toLocaleString()} {visitDetail.check_out_time ? `- ${new Date(visitDetail.check_out_time).toLocaleTimeString()}` : ""}
                </p>
              </div>

              {visitDetail.diagnoses && visitDetail.diagnoses.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Diagnoses</p>
                  <div className="space-y-1">
                    {visitDetail.diagnoses.map((d: any) => (
                      <div key={d.id} className="text-sm">
                        <span className="font-medium">{d.description || "No description"}</span>
                        {d.icd10_code && <span className="text-xs text-zinc-500 ml-2">({d.icd10_code})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visitDetail.treatments && visitDetail.treatments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Treatments</p>
                  <div className="space-y-1">
                    {visitDetail.treatments.map((t: any) => (
                      <div key={t.id} className="text-sm">
                        {t.treatment_plan || "No plan"}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visitDetail.prescriptions && visitDetail.prescriptions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Prescriptions</p>
                  <div className="space-y-1">
                    {visitDetail.prescriptions.map((p: any) => (
                      <div key={p.id} className="text-sm">
                        {p.medicine_name} {p.dosage ? `· ${p.dosage}` : ""} {p.frequency ? `· ${p.frequency}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedVisit(null); setVisitDetail(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}