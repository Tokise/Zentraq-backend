"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { MedicalRecordView } from "@/components/medical/medical-record-view"
import { getOwnMedicalRecord, type PatientMedicalRecord } from "@/app/actions/medical-records"
import { Card, CardContent } from "@/components/ui/card"
import { HeartPulse } from "lucide-react"
import { toast } from "sonner"

export default function FacultyRecordsPage() {
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRecord() {
      setLoading(true)
      try {
        const res = await getOwnMedicalRecord()
        if (res.error) {
          setError(res.error)
        } else {
          setRecord(res.record)
        }
      } catch (err: any) {
        setError(err.message || "Failed to load health records")
      } finally {
        setLoading(false)
      }
    }
    loadRecord()
  }, [])

  return (
    <div className="space-y-6 max-w-5xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="My Health Records"
        description="View your medical history, allergies, and medications."
      />

      {loading ? (
        <Card className="border-zinc-200/80 shadow-sm bg-white">
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-zinc-100 rounded-lg animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : !record ? (
        <Card className="border-zinc-200/80 shadow-sm bg-white">
          <CardContent className="py-14 px-6 text-center space-y-2">
            <HeartPulse className="size-8 text-zinc-300 mx-auto" />
            <p className="text-sm font-medium text-zinc-600">No health records found</p>
            <p className="text-xs text-zinc-400">
              {error || "Your medical records will appear here after your first clinic visit."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <MedicalRecordView record={record} canEdit={false} />
      )}
    </div>
  )
}