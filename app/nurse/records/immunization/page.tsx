"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Syringe } from "lucide-react"
import { toast } from "sonner"
import { getPatientMedicalRecord } from "@/actions/clinical/records"
import { searchRecordsAction } from "@/actions/admin/records"

export default function NurseRecordsImmunizationPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Record<string, any> | null>(null)
  const [record, setRecord] = useState<any>(null)
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
      }
    } finally {
      setLoadingRecord(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Immunization Records" description="View patient immunization history." />

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
          <CardContent className="p-0">
            {record.immunizations && record.immunizations.length > 0 ? (
              <div className="divide-y">
                {record.immunizations.map((imm: any) => (
                  <div key={imm.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50/50">
                    <div className="size-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <Syringe className="size-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{imm.vaccine_name}</p>
                      <p className="text-xs text-zinc-500">{imm.vaccine_type} · Dose {imm.dose_number}</p>
                      {imm.lot_number && <p className="text-xs text-zinc-400">Lot: {imm.lot_number}</p>}
                    </div>
                    <div className="text-right">
                      {imm.administered_date && (
                        <p className="text-xs text-zinc-500">
                          {new Date(imm.administered_date).toLocaleDateString()}
                        </p>
                      )}
                      {imm.administered_by && (
                        <p className="text-xs text-zinc-400">By: {imm.administered_by}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <Syringe className="size-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No immunization records.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}