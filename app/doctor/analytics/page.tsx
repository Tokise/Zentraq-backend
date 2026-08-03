import { PageHeader } from "@/components/page-header"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { ConsultationChart } from "@/components/analytics/consultation-chart"
import { ComplaintChart } from "@/components/analytics/complaint-chart"
import { getAnalyticsOverview, getDailyConsultations, getComplaintFrequency, getDoctorStats } from "@/app/actions/analytics"
import { getActionActor } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

export default async function DoctorAnalyticsPage() {
  const actor = await getActionActor()
  if (!actor) {
    return (
      <main className="space-y-6">
        <PageHeader
          title="Analytics"
          description="View your personal analytics and performance metrics."
        />
        <div className="text-center text-muted-foreground">
          Not authenticated
        </div>
      </main>
    )
  }

  const { data: doctor } = await createAdminClient()
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", actor.id)
    .single()

  const { overview } = await getAnalyticsOverview()
  const { data: consultations } = await getDailyConsultations()
  const { data: complaints } = await getComplaintFrequency()
  const { stats } = doctor ? await getDoctorStats(doctor.id) : { stats: null }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Analytics"
        description="View your personal analytics and performance metrics."
      />

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Consultations Completed</p>
            <p className="text-2xl font-bold">{stats.consultations_completed}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Prescriptions Written</p>
            <p className="text-2xl font-bold">{stats.prescriptions_written}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Clearances Evaluated</p>
            <p className="text-2xl font-bold">{stats.clearances_evaluated}</p>
          </div>
        </div>
      )}

      {overview && <AnalyticsDashboard overview={overview} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {consultations && consultations.length > 0 && (
          <ConsultationChart data={consultations} />
        )}
        {complaints && complaints.length > 0 && (
          <ComplaintChart data={complaints} />
        )}
      </div>
    </main>
  )
}