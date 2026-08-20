import { RecordsIndexWorkspace } from "@/components/medical/records-index-workspace"

// Renders the Nurse Employee Records index with Sick Leave capability.
export default function NurseEmployeeRecordsPage() {
  return <RecordsIndexWorkspace clinicRole="nurse" scope="employee" />
}
