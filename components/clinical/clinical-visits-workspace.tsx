"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import {
  getConsultationQueue,
  type QueueConsultation,
} from "@/actions/inventory/workflow-queries"
import { ConsultationWizard } from "@/components/clinical/consultation-wizard"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import {
  DataTablePagination,
  useTablePagination,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Renders the assignment-aware active consultation table for every clinic role.
export function ClinicalVisitsWorkspace() {
  const searchParams = useSearchParams()
  const [consultations, setConsultations] = useState<QueueConsultation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null)
  const pagination = useTablePagination(consultations)

  // Loads the protected worklist for the signed-in clinic account.
  const loadConsultations = useCallback(async () => {
    setLoading(true)
    const result = await getConsultationQueue([
      "queued",
      "in-progress",
      "awaiting_doctor_review",
    ])
    if (result.error) toast.error(result.error)
    setConsultations(result.consultations)
    setLoading(false)
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadConsultations()
      const consultationId = searchParams.get("consultation")
      if (consultationId) setSelectedConsultationId(consultationId)
    }, 0)

    return () => window.clearTimeout(initialLoad)
  }, [loadConsultations, searchParams])

  return (
    <div className="space-y-6">
      <PageHeader
        description="Open an active consultation or create a new walk-in visit."
        title="Visit"
      />

      <div className="border border-border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Visit reason</TableHead>
                <TableHead>Checked in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.map((consultation) => (
                <TableRow key={consultation.id}>
                  <TableCell className="font-medium">
                    {consultation.patient_name}
                  </TableCell>
                  <TableCell>{consultation.patient_complaint || "—"}</TableCell>
                  <TableCell>
                    {new Date(consultation.check_in_time).toLocaleString()}
                  </TableCell>
                  <TableCell className="capitalize">
                    {consultation.status.replaceAll("_", " ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      aria-label={`Open consultation for ${consultation.patient_name}`}
                      onClick={() =>
                        setSelectedConsultationId(consultation.id)
                      }
                      size="sm"
                      variant="outline"
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DataTablePagination
          className="px-4 pb-4"
          currentPage={pagination.currentPage}
          onPageChange={pagination.setCurrentPage}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          totalPages={pagination.totalPages}
        />
      </div>

      {selectedConsultationId && (
        <ConsultationWizard
          consultationId={selectedConsultationId}
          onCompleted={() => {
            setSelectedConsultationId(null)
            void loadConsultations()
          }}
          onOpenChange={(open) => !open && setSelectedConsultationId(null)}
          open
        />
      )}
    </div>
  )
}
