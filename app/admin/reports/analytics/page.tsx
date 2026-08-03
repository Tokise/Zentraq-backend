import { PageHeader } from "@/components/page-header"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { ConsultationChart } from "@/components/analytics/consultation-chart"
import { ComplaintChart } from "@/components/analytics/complaint-chart"
import { ComplianceDashboard } from "@/components/analytics/compliance-dashboard"
import { getAnalyticsOverview, getDailyConsultations, getComplaintFrequency, getClearanceCompletion } from "@/app/actions/analytics"

export default async function AdminAnalyticsPage() {
  const { overview } = await getAnalyticsOverview()
  const { data: consultations } = await getDailyConsultations()
  const { data: complaints } = await getComplaintFrequency()
  const { data: compliance } = await getClearanceCompletion()

  return (
    <main className="space-y-6">
      <PageHeader
        title="Analytics Dashboard"
        description="View clinic performance metrics and compliance data."
      />

      {overview && <AnalyticsDashboard overview={overview} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {consultations && consultations.length > 0 && (
          <ConsultationChart data={consultations} />
        )}
        {complaints && complaints.length > 0 && (
          <ComplaintChart data={complaints} />
        )}
      </div>

      {compliance && compliance.length > 0 && (
        <ComplianceDashboard data={compliance} />
      )}
    </main>
  )
}
