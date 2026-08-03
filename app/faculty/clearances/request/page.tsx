import { PageHeader } from "@/components/page-header"
import { ClearanceRequestForm } from "@/components/clearance/clearance-request-form"
import { submitClearanceRequest } from "@/app/actions/clearances"
import { getActionActor } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { toast } from "sonner"
import { redirect } from "next/navigation"

export default async function FacultyClearancesRequestPage() {
  const actor = await getActionActor()
  if (!actor) {
    redirect("/login")
  }

  const { data: faculty } = await createAdminClient()
    .from("faculty")
    .select("id")
    .eq("user_id", actor.id)
    .single()

  if (!faculty) {
    return (
      <main className="space-y-6">
        <PageHeader
          title="Request Clearance"
          description="Request a new health clearance."
        />
        <div className="text-center text-muted-foreground">
          Faculty record not found.
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
        requesterType="faculty"
        requesterId={faculty.id}
        onSubmit={async (data) => {
          "use server"
          const result = await submitClearanceRequest({
            requester_type: "faculty",
            requester_id: faculty.id,
            purpose: data.purpose
          })
          if (result.error) {
            toast.error(result.error)
            throw new Error(result.error)
          }
          redirect("/faculty/clearances")
        }}
      />
    </main>
  )
}