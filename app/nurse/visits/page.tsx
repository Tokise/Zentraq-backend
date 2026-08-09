"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  getConsultationQueue,
  type QueueConsultation,
} from "@/actions/inventory/workflow-queries";
import { PageHeader } from "@/components/common/page-header";
import {
  DataTablePagination,
  useTablePagination,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConsultationWizard } from "@/components/clinical/consultation-wizard";

// Lists active consultations and opens the unified clinical workspace.
export default function NurseVisitsPage() {
  const searchParams = useSearchParams();
  const [consultations, setConsultations] = useState<QueueConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null);
  const pagination = useTablePagination(consultations);

  // Loads the active clinical worklist.
  async function loadConsultations() {
    setLoading(true);
    const result = await getConsultationQueue([
      "queued",
      "in-progress",
      "awaiting_doctor_review",
    ]);
    if (result.error) toast.error(result.error);
    setConsultations(result.consultations);
    setLoading(false);
  }

  useEffect(() => {
    void loadConsultations();
    const consultationId = searchParams.get("consultation");
    if (consultationId) setSelectedConsultationId(consultationId);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visit"
        description="Open an active consultation or create a new walk-in visit."
      />

      <div className="bg-card shadow-sm">
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
                <TableHead>Complaint</TableHead>
                <TableHead>Checked in</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.map((consultation) => (
                <TableRow
                  key={consultation.id}
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setSelectedConsultationId(consultation.id)}
                >
                  <TableCell className="font-medium">
                    {consultation.patient_name}
                  </TableCell>
                  <TableCell>{consultation.complaint || "—"}</TableCell>
                  <TableCell>
                    {new Date(consultation.check_in_time).toLocaleString()}
                  </TableCell>
                  <TableCell className="capitalize">
                    {consultation.status}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DataTablePagination
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
          open
          onOpenChange={(open) => !open && setSelectedConsultationId(null)}
          onCompleted={() => {
            setSelectedConsultationId(null);
            void loadConsultations();
          }}
        />
      )}
    </div>
  );
}
