import { PageHeader } from "@/components/page-header"
import { MedicalRecordView } from "@/components/medical/medical-record-view"
import { getPatientMedicalRecord } from "@/app/actions/medical-records"
import { notFound } from "next/navigation"

interface DoctorPatientPageProps {
  params: {
    id: string
  }
}

export default async function DoctorPatientPage({ params }: DoctorPatientPageProps) {
  const { record, error } = await getPatientMedicalRecord(params.id, "student")
  
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
