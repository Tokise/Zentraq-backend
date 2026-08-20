"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  getComplianceRecordAction,
  getOwnPatientProfileAction,
  type ComplianceRecordDTO,
} from "@/actions/clinical/records/compliance"
import { PageHeader } from "@/components/common/page-header"
import { HealthRecordTabs } from "@/components/medical/health-record-tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient as createBrowserClient } from "@/utils/supabase/client"

// Renders the signed-in user's patient record with every mutation disabled.
export function MyHealthRecordWorkspace() {
  const [supabase] = useState(() => createBrowserClient())
  const [record, setRecord] = useState<ComplianceRecordDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Resolves the patient profile by user_id and loads its authorized record.
  const loadOwnRecord = useCallback(async () => {
    setLoading(true)
    setError(null)
    const profileResult = await getOwnPatientProfileAction()
    if (profileResult.error || !profileResult.profile) {
      const message = profileResult.error ?? "Patient profile not found"
      setError(message)
      setLoading(false)
      return
    }

    const recordResult = await getComplianceRecordAction({
      accessMode: "own",
      patientId: profileResult.profile.id,
      patientRole: profileResult.profile.role,
    })
    if (recordResult.error || !recordResult.record) {
      const message = recordResult.error ?? "Health record not found"
      toast.error(message)
      setError(message)
      setLoading(false)
      return
    }

    setRecord(recordResult.record)
    setLoading(false)
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadOwnRecord()
    }, 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadOwnRecord])

  // Refreshes the authorized own-record DTO after private patient invalidation.
  useEffect(() => {
    if (!record) return
    let reloadTimer: number | undefined
    const topic =
      `patient-record:${record.profile.role}:${record.profile.id}`
    const channel = supabase.channel(topic, {
      config: { private: true },
    })

    void supabase.realtime.setAuth().then(() => {
      channel
        .on("broadcast", { event: "patient-record-changed" }, () => {
          window.clearTimeout(reloadTimer)
          reloadTimer = window.setTimeout(() => {
            void loadOwnRecord()
          }, 100)
        })
        .subscribe()
    })

    return () => {
      window.clearTimeout(reloadTimer)
      void supabase.removeChannel(channel)
    }
  }, [loadOwnRecord, record, supabase])

  return (
    <div className="space-y-6">
      <PageHeader
        description="Your private, read-only profile and compliance documents."
        title="My Health Records"
      />
      {loading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-52 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : record ? (
        <HealthRecordTabs
          capabilities={{ canAddExam: false, canAddSickLeave: false }}
          key={record.profile.id}
          readOnly
          record={record}
          role={record.profile.role}
        />
      ) : null}
    </div>
  )
}
