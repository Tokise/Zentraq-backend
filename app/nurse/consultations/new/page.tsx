"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, UserPlus, Stethoscope } from "lucide-react"
import { getPatientMedicalRecord } from "@/app/actions/medical-records"
import { createConsultation } from "@/app/actions/clinical"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type PatientType = "student" | "faculty"

interface PatientRow {
  patient_id: string
  identifier: string
  first_name: string
  last_name: string
  patient_type: PatientType
}

export default function NurseConsultationNewPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [patientType, setPatientType] = useState<PatientType>("student")
  const [results, setResults] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const searchPatients = async () => {
    if (!search.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const result = await getPatientMedicalRecord("all", patientType)
      if (result.error) {
        toast.error(result.error)
        setResults([])
      } else if (result.record) {
        const r = result.record
        const haystack = [r.first_name, r.last_name, r.identifier, r.phone, r.email, r.rfid_uid].filter(Boolean).join(" ").toLowerCase()
        if (haystack.includes(search.trim().toLowerCase())) {
          setResults([{
            patient_id: r.patient_id,
            identifier: r.identifier,
            first_name: r.first_name,
            last_name: r.last_name,
            patient_type: r.patient_type
          }])
        } else {
          setResults([])
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPatient = (patient: PatientRow) => {
    setSelectedPatient(patient)
    setSearch("")
    setResults([])
  }

  const handleCreateConsultation = async () => {
    if (!selectedPatient || !chiefComplaint.trim()) {
      toast.error("Please enter a chief complaint")
      return
    }
    setSubmitting(true)
    try {
      const result = await createConsultation({
        patient_id: selectedPatient.patient_id,
        patient_type: selectedPatient.patient_type,
        chief_complaint: chiefComplaint,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Consultation created")
        router.push("/nurse/consultations/triage")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create consultation")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Walk-in Registration"
        description="Register a new clinic visit for a patient."
      />

      <Card className="border-zinc-200/80 shadow-sm bg-white">
        <CardContent className="pt-6 space-y-4">
          {!selectedPatient ? (
            <>
              <div className="flex items-center gap-2">
                {(["student", "faculty"] as PatientType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setPatientType(type); setResults([]); setSearch("") }}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors capitalize ${patientType === type ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchPatients()}
                  placeholder="Search by name, ID, phone, or RFID..."
                  className="h-9 pl-8 text-sm"
                />
                <Button
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                  onClick={searchPatients}
                  disabled={loading}
                >
                  Search
                </Button>
              </div>

              {loading && (
                <div className="divide-y divide-zinc-100">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
                      <div className="size-8 rounded-full bg-zinc-100 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 bg-zinc-100 rounded" />
                        <div className="h-2.5 w-20 bg-zinc-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="border rounded-lg divide-y divide-zinc-100">
                  {results.map((patient) => (
                    <button
                      key={patient.patient_id}
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 text-left"
                    >
                      <div className="size-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                        {patient.first_name[0]}{patient.last_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{patient.first_name} {patient.last_name}</p>
                        <p className="text-xs text-zinc-400">{patient.identifier} • {patient.patient_type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!loading && search && results.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-4">No patients found.</p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-500">
                    {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                  </div>
                  <div>
                    <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                    <p className="text-xs text-zinc-400">{selectedPatient.identifier} • {selectedPatient.patient_type}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
                  Change
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Chief Complaint</label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Describe the reason for the visit..."
                  className="w-full rounded-md border border-zinc-200 p-2 text-sm min-h-[100px]"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCreateConsultation}
                disabled={submitting || !chiefComplaint.trim()}
              >
                <Stethoscope className="size-4 mr-2" />
                {submitting ? "Registering..." : "Register Consultation"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}