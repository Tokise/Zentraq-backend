"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Scan, UserCheck, UserPlus } from "lucide-react"
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
  rfid_uid: string | null
}

export default function NurseRFIDPage() {
  const router = useRouter()
  const [rfidInput, setRfidInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [foundPatient, setFoundPatient] = useState<PatientRow | null>(null)
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleRFIDLookup = async () => {
    if (!rfidInput.trim()) {
      toast.error("Please enter or scan an RFID")
      return
    }
    setLoading(true)
    setFoundPatient(null)
    try {
      const result = await getPatientMedicalRecord("all", "student")
      if (result.error) {
        toast.error(result.error)
      } else if (result.record && result.record.rfid_uid === rfidInput.trim()) {
        setFoundPatient({
          patient_id: result.record.patient_id,
          identifier: result.record.identifier,
          first_name: result.record.first_name,
          last_name: result.record.last_name,
          patient_type: result.record.patient_type,
          rfid_uid: result.record.rfid_uid
        })
      } else {
        const facultyResult = await getPatientMedicalRecord("all", "faculty")
        if (facultyResult.record && facultyResult.record.rfid_uid === rfidInput.trim()) {
          setFoundPatient({
            patient_id: facultyResult.record.patient_id,
            identifier: facultyResult.record.identifier,
            first_name: facultyResult.record.first_name,
            last_name: facultyResult.record.last_name,
            patient_type: facultyResult.record.patient_type,
            rfid_uid: facultyResult.record.rfid_uid
          })
        } else {
          toast.error("No patient found with this RFID")
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Lookup failed")
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = async () => {
    if (!foundPatient || !chiefComplaint.trim()) {
      toast.error("Please enter a chief complaint")
      return
    }
    setSubmitting(true)
    try {
      const result = await createConsultation({
        patient_id: foundPatient.patient_id,
        patient_type: foundPatient.patient_type,
        chief_complaint: chiefComplaint,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Patient checked in successfully")
        setRfidInput("")
        setFoundPatient(null)
        setChiefComplaint("")
        router.push("/nurse/consultations/triage")
      }
    } catch (err: any) {
      toast.error(err.message || "Check-in failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="RFID Check-In"
        description="Scan or enter patient RFID for quick check-in."
      />

      <Card className="border-zinc-200/80 shadow-sm bg-white">
        <CardContent className="pt-6 space-y-4">
          {!foundPatient ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Scan className="size-4" />
                <span>Scan RFID badge or enter manually</span>
              </div>

              <div className="flex gap-2">
                <Input
                  value={rfidInput}
                  onChange={(e) => setRfidInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRFIDLookup()}
                  placeholder="Enter RFID number..."
                  className="h-10 text-sm font-mono"
                />
                <Button
                  onClick={handleRFIDLookup}
                  disabled={loading}
                  className="h-10"
                >
                  <Search className="size-4 mr-2" />
                  Lookup
                </Button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="size-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-zinc-100 flex items-center justify-center text-lg font-bold text-zinc-500">
                    {foundPatient.first_name[0]}{foundPatient.last_name[0]}
                  </div>
                  <div>
                    <p className="font-medium">{foundPatient.first_name} {foundPatient.last_name}</p>
                    <p className="text-xs text-zinc-400">{foundPatient.identifier} • {foundPatient.patient_type}</p>
                    {foundPatient.rfid_uid && (
                      <p className="text-xs text-zinc-400 font-mono">RFID: {foundPatient.rfid_uid}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  <UserCheck className="size-3 mr-1" />
                  Found
                </Badge>
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

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleCheckIn}
                  disabled={submitting || !chiefComplaint.trim()}
                >
                  <UserPlus className="size-4 mr-2" />
                  {submitting ? "Checking in..." : "Check In"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setFoundPatient(null); setRfidInput(""); setChiefComplaint("") }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}