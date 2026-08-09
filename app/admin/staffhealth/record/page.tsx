import { RecordsIndexWorkspace } from "@/components/medical/records-index-workspace"

// Renders the Admin Employee Records index and shared health-record tabs.
export default function AdminEmployeeRecordsPage() {
  return <RecordsIndexWorkspace clinicRole="admin" scope="employee" />
}
