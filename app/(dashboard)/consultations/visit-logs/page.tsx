"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Search } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { toast } from "sonner"

type CompletionReport = {
  diagnosis: string
  treatment: string
  recommendations: string
}

type ConsultationRecord = {
  id: string
  profile_id: string | null
  patient_name: string
  chief_complaint: string
  status: "waiting" | "in_progress" | "completed" | "dismissed" | "emergency"
  created_at: string
  handled_at: string | null
  notes: string | null
}

const PAGE_SIZE = 10

function statusVariant(status: string) {
  switch (status) {
    case "completed":
      return "success" as const
    case "dismissed":
      return "default" as const
    case "emergency":
      return "danger" as const
    default:
      return "default" as const
  }
}

export default function VisitLogsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [records, setRecords] = useState<ConsultationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRecord, setSelectedRecord] =
    useState<ConsultationRecord | null>(null)
  const [page, setPage] = useState(1)

  const fetchRecords = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .in("status", ["completed", "dismissed", "emergency"])
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      if (data) setRecords(data as ConsultationRecord[])
    } catch (err) {
      console.error("Error fetching visit logs:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const filteredRecords = records.filter(
    (r) =>
      r.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.chief_complaint.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / PAGE_SIZE)
  )
  const safePage = Math.min(page, totalPages)
  const paginatedRecords = filteredRecords.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

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
                setPage(1)
              }}
              className="pl-9"
            />
          </div>

          {paginatedRecords.length === 0 ? (
            <EmptyState
              title="No visit records found"
              description="Completed and dismissed consultations will appear here."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Complaint</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <TableCell className="font-medium">
                        {record.patient_name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.chief_complaint}
                      </TableCell>
                      <TableCell>
                        {new Date(record.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={statusVariant(record.status)}>
                          {record.status.replace("_", " ")}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={filteredRecords.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
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
                  <p className="text-sm font-medium">
                    {selectedRecord.patient_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge
                    status={statusVariant(selectedRecord.status)}
                    className="mt-0.5"
                  >
                    {selectedRecord.status.replace("_", " ")}
                  </StatusBadge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Student Complaint
                </p>
                <p className="text-sm">{selectedRecord.chief_complaint}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm">
                    {new Date(
                      selectedRecord.created_at
                    ).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {selectedRecord.handled_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Handled At
                    </p>
                    <p className="text-sm">
                      {new Date(
                        selectedRecord.handled_at
                      ).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                )}
              </div>

              {selectedRecord.notes && (() => {
                try {
                  const r = JSON.parse(selectedRecord.notes) as CompletionReport
                  if (r.diagnosis || r.treatment || r.recommendations) {
                    return (
                      <div>
                        <p className="text-xs text-muted-foreground">Consultation Report</p>
                        <div className="mt-1 space-y-2 rounded-md border border-border p-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Diagnosis / Findings</p>
                            <p className="text-sm">{r.diagnosis}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Treatment Given</p>
                            <p className="text-sm">{r.treatment}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Recommendations</p>
                            <p className="text-sm">{r.recommendations}</p>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  throw new Error("not structured")
                } catch {
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm mt-1">{selectedRecord.notes}</p>
                    </div>
                  )
                }
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}