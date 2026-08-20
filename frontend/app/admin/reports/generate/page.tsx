import { ClinicalReportsWorkspace } from "@/components/analytics/clinical-reports-workspace"

// Shows clinic-wide aggregate analytics to Admin.
export default function AdminReportsGeneratePage() {
  return <ClinicalReportsWorkspace role="admin" />
}
