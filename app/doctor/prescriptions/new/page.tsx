import { PageHeader } from "@/components/page-header"
import { PrescriptionForm } from "@/components/pharmacy/prescription-form"
import { createPrescription } from "@/app/actions/prescriptions"
import { toast } from "sonner"
import { redirect } from "next/navigation"

interface DoctorPrescriptionNewPageProps {
  searchParams: {
    consultationId?: string
  }
}

export default async function DoctorPrescriptionsNewPage({ searchParams }: DoctorPrescriptionNewPageProps) {
  const consultationId = searchParams.consultationId

  if (!consultationId) {
    return (
      <main className="space-y-6">
        <PageHeader
          title="Write Prescription"
          description="Create a new medical prescription."
        />
        <div className="text-center text-muted-foreground">
          Please select a consultation first to create a prescription.
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Write Prescription"
        description="Create a new medical prescription."
      />
      <PrescriptionForm
        consultationId={consultationId}
        onSubmit={async (data) => {
          "use server"
          const result = await createPrescription(consultationId, data)
          if (result.error) {
            toast.error(result.error)
            throw new Error(result.error)
          }
          toast.success("Prescription created successfully")
          redirect(`/doctor/consultations`)
        }}
      />
    </main>
  )
}