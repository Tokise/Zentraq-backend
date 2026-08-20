import { ClinicalReportsWorkspace } from "@/components/analytics/clinical-reports-workspace"

// Shows read-only aggregate clinic analytics to Nurse.
export default function NurseReportsPage() {
  return <ClinicalReportsWorkspace role="nurse" />
}
