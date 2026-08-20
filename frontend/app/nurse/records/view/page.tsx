import { RecordsIndexWorkspace } from "@/components/medical/records-index-workspace"

// Renders the Nurse Student Records index with read-only annual exams.
export default function NurseStudentRecordsPage() {
  return <RecordsIndexWorkspace clinicRole="nurse" scope="student" />
}
