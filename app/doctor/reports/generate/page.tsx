import { ClinicalReportsWorkspace } from "@/components/analytics/clinical-reports-workspace"

// Shows read-only aggregate clinic analytics to Doctor.
export default function DoctorReportsGeneratePage() {
  return <ClinicalReportsWorkspace role="doctor" />
}
