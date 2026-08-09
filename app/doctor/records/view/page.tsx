import { RecordsIndexWorkspace } from "@/components/medical/records-index-workspace"

// Renders the Doctor Student Records index with read-only annual exams.
export default function DoctorStudentRecordsPage() {
  return <RecordsIndexWorkspace clinicRole="doctor" scope="student" />
}
