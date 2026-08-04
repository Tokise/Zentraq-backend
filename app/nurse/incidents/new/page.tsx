import { PageHeader } from "@/components/page-header"
import { IncidentReportForm } from "@/components/incident/incident-report-form"
import { reportIncident } from "@/app/actions/incidents"
import { toast } from "sonner"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

interface NurseIncidentNewPageProps {
  searchParams: Promise<{
    patientId?: string
    patientType?: "student" | "faculty"
  }>
}

export default async function NurseIncidentNewPage({ searchParams }: NurseIncidentNewPageProps) {
  const { patientId, patientType = "student" } = await searchParams

  if (!patientId) {
    return (
      <main className="space-y-6">
        <PageHeader
          title="Report Incident"
          description="Report a new incident or emergency case."
        />
        <div className="text-center text-muted-foreground">
          Please select a patient first to report an incident.
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Report Incident"
        description="Report a new incident or emergency case."
      />
      <IncidentReportForm
        patientType={patientType}
        patientId={patientId}
        onSubmit={async (data) => {
          "use server"
          const result = await reportIncident({
            patient_type: patientType,
            patient_id: patientId,
            ...data
          })
          if (result.error) {
            toast.error(result.error)
            throw new Error(result.error)
          }
          redirect("/nurse/incidents")
        }}
      />
    </main>
  )
}