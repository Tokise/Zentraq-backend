import { RecordsIndexWorkspace } from "@/components/medical/records-index-workspace"

// Renders the Doctor Employee Records index with Sick Leave capability.
export default function DoctorEmployeeRecordsPage() {
  return <RecordsIndexWorkspace clinicRole="doctor" scope="employee" />
}
