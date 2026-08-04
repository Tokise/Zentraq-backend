import { PageHeader } from "@/components/page-header"
import { ClearanceRequestForm } from "@/components/clearance/clearance-request-form"
import { submitClearanceRequest } from "@/app/actions/clearances"
import { getActionActor } from "@/lib/security/action-guard"
import { getStudentProfileIdAction } from "@/app/student/actions"
import { toast } from "sonner"
import { redirect } from "next/navigation"

export default async function StudentClearancesRequestPage() {
  const actor = await getActionActor()
  if (!actor) {
    redirect("/login")
  }

  const { studentId } = await getStudentProfileIdAction()

  if (!studentId) {
    return (
      <main className="space-y-6">
        <PageHeader
          title="Request Clearance"
          description="Submit a health clearance request."
        />
        <div className="text-center text-muted-foreground">
          Student record not found.
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Request Health Clearance"
        description="Submit a request for medical health clearance."
      />
      <ClearanceRequestForm
        requesterType="student"
        requesterId={studentId}
        onSubmit={async (data) => {
          /* use server */
          const result = await submitClearanceRequest({
            requester_type: "student",
            requester_id: studentId,
            purpose: data.purpose
          })
          if (result.error) {
            toast.error(result.error)
            throw new Error(result.error)
          }
          redirect("/student/clearances")
        }}
      />
    </main>
  )
}