"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import {
  getConsultationQueueAction,
  type QueueConsultation,
} from "@/actions/clinical/queues"
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
  const router = useRouter()
  const pathname = usePathname()
  const [consultations, setConsultations] = useState<QueueConsultation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null)
  const closedConsultationIdsRef = useRef<Set<string>>(new Set())
  const pagination = useTablePagination(consultations)

  const handleCloseWizard = useCallback(() => {
    if (selectedConsultationId) {
      closedConsultationIdsRef.current.add(selectedConsultationId)
    }
    setSelectedConsultationId(null)
    if (searchParams.has("consultation")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("consultation")
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
  }, [pathname, router, searchParams, selectedConsultationId])

  // Loads the protected worklist for the signed-in clinic account.
  const loadConsultations = useCallback(async () => {
    setLoading(true)
    const result = await getConsultationQueueAction(["in-progress"])
    if (result.error) toast.error(result.error)
    setConsultations(result.consultations)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadConsultations()
    const consultationId = searchParams.get("consultation")
    if (
      consultationId &&
      !closedConsultationIdsRef.current.has(consultationId)
    ) {
      setSelectedConsultationId(consultationId)
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        description="Continue active consultations you claimed from the RFID queue."
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
                <TableHead>Claimed by</TableHead>
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
                  <TableCell>
                    <div className="space-y-0.5">
                      <p>{consultation.claimed_by_name ?? "Current operator"}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {consultation.claimed_by_role ?? "clinic staff"}
                      </p>
                    </div>
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
            handleCloseWizard()
            void loadConsultations()
          }}
          onOpenChange={(open) => !open && handleCloseWizard()}
          open
        />
      )}
    </div>
  )
}
