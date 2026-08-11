"use client"

import { useCallback, useEffect, useState } from "react"
import { EyeIcon, StethoscopeIcon } from "lucide-react"
import { toast } from "sonner"

import {
  getClinicalVisitHistory,
  type ClinicalVisitHistoryRow,
} from "@/actions/clinical/visit-history"
import { ConsultationDetailDialog } from "@/components/clinical/consultation-detail-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
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

// Renders the role-scoped completed consultation history table.
export function ClinicalVisitHistoryWorkspace() {
  const [visits, setVisits] = useState<ClinicalVisitHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null)
  const pagination = useTablePagination(visits)

  // Loads completed visits through the assignment-aware server action.
  const loadHistory = useCallback(async () => {
    setLoading(true)
    const result = await getClinicalVisitHistory()
    if (result.error) toast.error(result.error)
    setVisits(result.visits)
    setLoading(false)
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadHistory(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadHistory])

  return (
    <div className="space-y-6">
      <PageHeader
        description="Completed patient consultations available to your clinic role."
        title="Visit History"
      />

      <div className="border border-border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        ) : visits.length === 0 ? (
          <div className="p-6">
            <EmptyState
              description="Completed clinic consultations will appear here."
              icon={StethoscopeIcon}
              title="No visit history"
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Visit type</TableHead>
                <TableHead>Visit reason</TableHead>
                <TableHead>Handled by</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.map((visit) => (
                <TableRow key={visit.consultation_id}>
                  <TableCell className="font-medium">
                    {visit.patient_name}
                  </TableCell>
                  <TableCell className="capitalize">
                    {visit.patient_type}
                  </TableCell>
                  <TableCell className="capitalize">
                    {visit.visit_type.replaceAll("_", " ")}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {visit.patient_complaint || "—"}
                  </TableCell>
                  <TableCell>
                    <ClinicianAttribution visit={visit} />
                  </TableCell>
                  <TableCell>{formatDateTime(visit.check_in_time)}</TableCell>
                  <TableCell>
                    {visit.check_out_time
                      ? formatDateTime(visit.check_out_time)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status="success">
                      {visit.status.replaceAll("_", " ")}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      aria-label={`View consultation for ${visit.patient_name}`}
                      onClick={() =>
                        setSelectedConsultationId(visit.consultation_id)
                      }
                      size="sm"
                      type="button"
                    >
                      <EyeIcon className="size-4" />
                      View
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

      <ConsultationDetailDialog
        consultationId={selectedConsultationId}
        onOpenChange={(open) => {
          if (!open) setSelectedConsultationId(null)
        }}
        open={Boolean(selectedConsultationId)}
      />
    </div>
  )
}

// Displays final ownership and any different preceding claimant without duplication.
function ClinicianAttribution({
  visit,
}: {
  visit: ClinicalVisitHistoryRow
}) {
  const primaryName = visit.completed_by_name ?? visit.claimed_by_name
  const primaryRole = visit.completed_by_role ?? visit.claimed_by_role
  const claimantDiffers = Boolean(
    visit.claimed_by_name &&
      visit.completed_by_name &&
      (visit.claimed_by_name !== visit.completed_by_name ||
        visit.claimed_by_role !== visit.completed_by_role),
  )

  if (!primaryName) {
    return <span className="text-muted-foreground">Not recorded</span>
  }

  return (
    <div className="min-w-40 space-y-1">
      <div>
        <p className="font-medium">{primaryName}</p>
        <p className="text-xs capitalize text-muted-foreground">
          {visit.completed_by_name ? "Completed" : "Claimed"} by{" "}
          {primaryRole ?? "clinic staff"}
        </p>
      </div>
      {claimantDiffers && (
        <p className="text-xs text-muted-foreground">
          Last claimed by {visit.claimed_by_name} ({visit.claimed_by_role})
        </p>
      )}
    </div>
  )
}

// Formats visit timestamps consistently across all clinical roles.
function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  })
}
