import { RecordsIndexWorkspace } from "@/components/medical/records-index-workspace"

// Renders the Admin Student Records index and shared health-record tabs.
export default function AdminStudentRecordsPage() {
  return <RecordsIndexWorkspace clinicRole="admin" scope="student" />
}
