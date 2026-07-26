"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Search } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { toast } from "sonner"

type VisitLogRecord = {
  id: string
  consultation_id: string | null
  patient_name: string
  student_complaint: string
  origin: "consultation" | "emergency"
  diagnosis: string
  treatment: string
  recommendations: string
  handled_at: string
  created_at: string
  status: string
}

function originVariant(origin: string) {
  return origin === "emergency" ? "danger" as const : "info" as const
}

function statusVariant(status: string) {
  switch (status) {
    case "return_to_class":
      return "success" as const
    case "return_to_activity":
      return "info" as const
    case "sent_home":
      return "warning" as const
    default:
      return "default" as const
  }
}

function formatStatusAbbr(status: string): string {
  switch (status) {
    case "return_to_class":
      return "RTC"
    case "return_to_activity":
      return "RTA"
    case "sent_home":
      return "SH"
    default:
      return status.replace(/_/g, " ")
  }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "return_to_class":
      return "Return to Class"
    case "return_to_activity":
      return "Return to Activity"
    case "sent_home":
      return "Sent Home"
    default:
      return status.replace(/_/g, " ")
  }
}

function formatOriginAbbr(origin: string): string {
  return origin === "emergency" ? "EC" : "NC"
}

function formatOriginFull(origin: string): string {
  return origin === "emergency" ? "Emergency Consultation" : "Normal Consultation"
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function VisitLogsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [records, setRecords] = useState<VisitLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRecord, setSelectedRecord] = useState<VisitLogRecord | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const fetchRecords = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("visit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      if (data) setRecords(data as VisitLogRecord[])
    } catch (err) {
      console.error("Error fetching visit logs:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchRecords()

    const channel = supabase
      .channel("visit-logs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_logs" },
        () => {
          fetchRecords()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchRecords, supabase])

  const filteredRecords = records.filter(
    (r) =>
      r.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.student_complaint.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group filtered records by date
  const groupedRecords: Record<string, VisitLogRecord[]> = {}
  for (const record of filteredRecords) {
    const dateKey = formatDateShort(record.created_at)
    if (!groupedRecords[dateKey]) {
      groupedRecords[dateKey] = []
    }
    groupedRecords[dateKey].push(record)
  }

  // Sort date groups in descending order (newest first)
  const sortedDateKeys = Object.keys(groupedRecords).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime()
  })

  function toggleDate(dateKey: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) {
        next.delete(dateKey)
      } else {
        next.add(dateKey)
      }
      return next
    })
  }

  // Auto-expand the most recent date group on load
  useEffect(() => {
    if (sortedDateKeys.length > 0 && expandedDates.size === 0) {
      setExpandedDates(new Set([sortedDateKeys[0]]))
    }
  }, [sortedDateKeys.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Visit Logs" description="Track all patient visit records.">
        <Button variant="outline" onClick={() => router.push("/consultations")}>
          <ArrowLeft className="size-4" />
          Back to Queue
        </Button>
      </PageHeader>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="relative mb-4 w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by patient name or complaint..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
              }}
              className="pl-9"
            />
          </div>

          {/* Legend for abbreviations */}
          {filteredRecords.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="font-medium">Legend:</span>
              <span className="flex items-center gap-1">
                <StatusBadge status="info">NC</StatusBadge> Normal Consultation
              </span>
              <span className="flex items-center gap-1">
                <StatusBadge status="danger">EC</StatusBadge> Emergency Consultation
              </span>
              <span className="flex items-center gap-1">
                <StatusBadge status="success">RTC</StatusBadge> Return to Class
              </span>
              <span className="flex items-center gap-1">
                <StatusBadge status="info">RTA</StatusBadge> Return to Activity
              </span>
              <span className="flex items-center gap-1">
                <StatusBadge status="warning">SH</StatusBadge> Sent Home
              </span>
            </div>
          )}

          {filteredRecords.length === 0 ? (
            <EmptyState
              title="No visit records found"
              description="Completed consultations will appear here once they are finished."
            />
          ) : (
            <div className="space-y-2">
              {sortedDateKeys.map((dateKey) => {
                const isExpanded = expandedDates.has(dateKey)
                const dayRecords = groupedRecords[dateKey]
                return (
                  <div key={dateKey} className="border border-border rounded-lg overflow-hidden">
                    {/* Date Header - Clickable to toggle */}
                    <button
                      type="button"
                      onClick={() => toggleDate(dateKey)}
                      className="flex items-center justify-between w-full px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium cursor-pointer"
                    >
                      <span>{dateKey}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {dayRecords.length} record{dayRecords.length !== 1 ? "s" : ""}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Records for this date */}
                    {isExpanded && (
                      <div className="divide-y divide-border">
                        {dayRecords.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setSelectedRecord(record)}
                          >
                            <StatusBadge status={originVariant(record.origin)}>
                              {formatOriginAbbr(record.origin)}
                            </StatusBadge>
                            <StatusBadge status={statusVariant(record.status)}>
                              {formatStatusAbbr(record.status)}
                            </StatusBadge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{record.patient_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{record.student_complaint}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTimeOnly(record.handled_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog
        open={selectedRecord !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRecord(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Visit Details</DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="text-sm font-medium">{selectedRecord.patient_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Origin</p>
                  <StatusBadge status={originVariant(selectedRecord.origin)} className="mt-1">
                    {formatOriginAbbr(selectedRecord.origin)} — {formatOriginFull(selectedRecord.origin)}
                  </StatusBadge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Disposition</p>
                  <StatusBadge status={statusVariant(selectedRecord.status)} className="mt-1">
                    {formatStatusLabel(selectedRecord.status)}
                  </StatusBadge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Student Complaint</p>
                <p className="text-sm">{selectedRecord.student_complaint}</p>
              </div>

              <div className="rounded-md border border-border p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consultation Report</p>
                <div>
                  <p className="text-xs text-muted-foreground">Diagnosis / Findings</p>
                  <p className="text-sm">{selectedRecord.diagnosis}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Treatment Given</p>
                  <p className="text-sm">{selectedRecord.treatment}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recommendations</p>
                  <p className="text-sm">{selectedRecord.recommendations}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm">{formatDateTime(selectedRecord.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Handled At</p>
                  <p className="text-sm">{formatDateTime(selectedRecord.handled_at)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}