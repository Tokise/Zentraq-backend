import { PageHeader } from "@/components/page-header"
import { ClearanceEvaluationForm } from "@/components/clearance/clearance-evaluation-form"
import { getClearanceDetail, recordClearanceEvaluation } from "@/app/actions/clearances"
import { notFound } from "next/navigation"
import { toast } from "sonner"
import { redirect } from "next/navigation"

interface DoctorClearancePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function DoctorClearancePage({ params }: DoctorClearancePageProps) {
  const { id } = await params
  const { clearance, error } = await getClearanceDetail(id)
  
  if (error || !clearance) {
    notFound()
  }

  const requester = clearance.students || clearance.faculty
  const requesterName = requester ? `${requester.first_name} ${requester.last_name}` : "Unknown"
  const requesterId = requester?.student_number || requester?.employee_number || "N/A"

  return (
    <main className="space-y-6">
      <PageHeader
        title="Medical Evaluation"
        description={`Evaluate health clearance for ${requesterName} (${requesterId})`}
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
            </div>
          </div>

          {clearance.clearance_evaluations && clearance.clearance_evaluations.length > 0 && (
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Previous Evaluations</h3>
              <div className="space-y-2">
                {clearance.clearance_evaluations.map((evaluation: any) => (
                  <div key={evaluation.id} className="bg-muted p-3 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize">{evaluation.result}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(evaluation.evaluated_at).toLocaleString()}
                      </span>
                    </div>
                    {evaluation.medical_notes && (
                      <p className="text-sm text-muted-foreground">{evaluation.medical_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ClearanceEvaluationForm
          clearanceId={id}
          onSubmit={async (data) => {
            "use server"
            const result = await recordClearanceEvaluation(id, data)
            if (result.error) {
              toast.error(result.error)
              throw new Error(result.error)
            }
            redirect("/doctor/clearances")
          }}
        />
      </div>
    </main>
  )
}
