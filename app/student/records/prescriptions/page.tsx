"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getOwnMedicalRecord, type PatientMedicalRecord } from "@/app/actions/medical-records"
import { Pill, Clock, Calendar, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export default function StudentPrescriptionsPage() {
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPrescriptions() {
      setLoading(true)
      try {
        const res = await getOwnMedicalRecord()
        if (res.error) {
          toast.error(res.error)
        } else {
          setRecord(res.record)
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load prescriptions")
      } finally {
        setLoading(false)
      }
    }
    loadPrescriptions()
  }, [])

  const medications = record?.medications || []

  return (
    <div className="space-y-6 max-w-5xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="My Prescriptions"
        description="View your active medications and prescription history issued by clinic doctors."
      />

      <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-zinc-100 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Pill className="size-4 text-emerald-600" />
            Prescribed Medications
          </CardTitle>
          <CardDescription>
            Medication details, dosage instructions, and prescription schedules.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-zinc-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : medications.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <Pill className="size-8 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No prescriptions found</p>
              <p className="text-xs text-zinc-400">Prescribed medicines from clinic visits will be listed here.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {medications.map((med) => (
                <div key={med.id} className="p-4 sm:p-5 hover:bg-zinc-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 text-sm">{med.medicine_name}</span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        Prescribed
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 pt-1">
                      {med.dosage && (
                        <span>
                          <span className="font-medium text-zinc-700">Dosage:</span> {med.dosage}
                        </span>
                      )}
                      {med.frequency && (
                        <span>
                          <span className="font-medium text-zinc-700">Frequency:</span> {med.frequency}
                        </span>
                      )}
                    </div>
                    {med.notes && (
                      <p className="text-xs text-zinc-500 pt-1">
                        <span className="font-medium text-zinc-700">Instructions:</span> {med.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-zinc-400 shrink-0">
                    Issued: {new Date(med.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}