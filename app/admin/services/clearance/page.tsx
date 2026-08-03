import { PageHeader } from "@/components/page-header"
import { ClearanceApprovalForm } from "@/components/clearance/clearance-approval-form"
import { getClearanceDetail, approveClearance, rejectClearance } from "@/app/actions/clearances"
import { notFound } from "next/navigation"
import { toast } from "sonner"
import { redirect } from "next/navigation"

interface AdminClearancePageProps {
  searchParams: {
    clearanceId?: string
  }
}

export default async function AdminClearancePage({ searchParams }: AdminClearancePageProps) {
  const clearanceId = searchParams.clearanceId

  if (!clearanceId) {
    return (
      <main className="space-y-6">
        <PageHeader
          title="Health Clearance"
          description="Manage health clearance requests."
        />
        <div className="text-center text-muted-foreground">
          Select a clearance from the queue to manage.
        </div>
      </main>
    )
  }

  const { clearance, error } = await getClearanceDetail(clearanceId)
  
  if (error || !clearance) {
    notFound()
  }

  const requester = clearance.students || clearance.faculty
  const requesterName = requester ? `${requester.first_name} ${requester.last_name}` : "Unknown"
  const requesterId = requester?.student_number || requester?.employee_number || "N/A"
  
  const latestEvaluation = clearance.clearance_evaluations?.[0]
  const evaluationResult = latestEvaluation?.result
  const medicalNotes = latestEvaluation?.medical_notes

  return (
    <main className="space-y-6">
      <PageHeader
        title="Health Clearance Approval"
        description={`Review and approve clearance for ${requesterName} (${requesterId})`}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Clearance Details</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Purpose:</span>
                <p className="font-medium">{clearance.purpose || "Not specified"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="font-medium capitalize">{clearance.status}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Requested:</span>
                <p>{new Date(clearance.created_at).toLocaleString()}</p>
              </div>
              {clearance.expires_at && (
                <div>
                  <span className="text-muted-foreground">Expires:</span>
                  <p>{new Date(clearance.expires_at).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {clearance.clearance_certificates && clearance.clearance_certificates.length > 0 && (
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Certificate</h3>
              <div className="bg-muted p-3 rounded">
                <p className="font-mono text-sm">{clearance.clearance_certificates[0].certificate_number}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Issued: {new Date(clearance.clearance_certificates[0].issued_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        <ClearanceApprovalForm
          clearanceId={clearanceId}
          currentStatus={clearance.status}
          evaluationResult={evaluationResult}
          medicalNotes={medicalNotes}
          onApprove={async (data) => {
            "use server"
            const result = await approveClearance(clearanceId, data)
            if (result.error) {
              toast.error(result.error)
              throw new Error(result.error)
            }
            redirect("/admin/services/clearance")
          }}
          onReject={async (reason) => {
            "use server"
            const result = await rejectClearance(clearanceId, reason)
            if (result.error) {
              toast.error(result.error)
              throw new Error(result.error)
            }
            redirect("/admin/services/clearance")
          }}
        />
      </div>
    </main>
  )
}
