"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getOwnMedicalRecord, type PatientMedicalRecord } from "@/app/actions/medical-records"
import { Stethoscope, Calendar, FileText, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

export default function StudentConsultationsPage() {
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRecord() {
      setLoading(true)
      try {
        const res = await getOwnMedicalRecord()
        if (res.error) {
          toast.error(res.error)
        } else {
          setRecord(res.record)
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load consultation history")
      } finally {
        setLoading(false)
      }
    }
    loadRecord()
  }, [])

  return (
    <div className="space-y-6 max-w-5xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="My Consultations"
        description="View your medical consultation history and diagnoses recorded by clinic staff."
      />

      <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-zinc-100 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Stethoscope className="size-4 text-blue-600" />
            Medical History & Conditions
          </CardTitle>
          <CardDescription>
            Diagnoses and medical notes logged during your clinic visits.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-zinc-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !record || (record.medical_history?.length === 0 && record.medications?.length === 0) ? (
            <div className="py-14 px-6 text-center space-y-2">
              <Stethoscope className="size-8 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No consultation records found</p>
              <p className="text-xs text-zinc-400">Your clinic visit consultations and diagnoses will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {record.medical_history?.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 hover:bg-zinc-50/60 transition-colors space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 text-sm">{item.condition}</span>
                    <span className="text-xs text-zinc-400">
                      {item.diagnosed_date ? new Date(item.diagnosed_date).toLocaleDateString() : "Active Record"}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-zinc-600 pt-1">
                      <span className="font-medium">Physician Notes:</span> {item.notes}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium pt-1">
                    <CheckCircle2 className="size-3" /> Status: {item.status || "Active"}
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