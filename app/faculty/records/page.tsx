import { PageHeader } from "@/components/page-header"
import { MedicalRecordView } from "@/components/medical/medical-record-view"
import { getOwnMedicalRecord } from "@/app/actions/medical-records"
import { notFound } from "next/navigation"

export default async function FacultyRecordsPage() {
  const { record, error } = await getOwnMedicalRecord()
  
  if (error || !record) {
    notFound()
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="My Health Records"
        description="View your medical history, allergies, and medications."
      />
      <MedicalRecordView record={record} canEdit={false} />
    </main>
  )
}