import { PageHeader } from "@/components/page-header"
import { MedicalRecordView } from "@/components/medical/medical-record-view"
import { getPatientMedicalRecord } from "@/app/actions/medical-records"
import { notFound } from "next/navigation"

interface NursePatientPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function NursePatientPage({ params }: NursePatientPageProps) {
  const { id } = await params
  const { record, error } = await getPatientMedicalRecord(id, "student")
  
  if (error || !record) {
    notFound()
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Patient Medical Record"
        description={`View and manage medical record for ${record.first_name} ${record.last_name}`}
      />
      <MedicalRecordView record={record} canEdit={true} />
    </main>
  )
}
