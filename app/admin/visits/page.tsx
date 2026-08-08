"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getConsultationQueue,
  type QueueConsultation,
} from "@/actions/inventory/workflow-queries";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConsultationWizard } from "@/components/clinical/consultation-wizard";

// Lists active consultations and hands each one to the unified consultation workspace.
export default function AdminVisitsPage() {
  const searchParams = useSearchParams();
  const [consultations, setConsultations] = useState<QueueConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null);

  // Loads the protected clinical worklist.
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
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin" />
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
              {consultations.map((consultation) => (
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
