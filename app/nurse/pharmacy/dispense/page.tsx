import { PageHeader } from "@/components/page-header"
import { DispensingForm } from "@/components/pharmacy/dispensing-form"
import { getPendingPrescriptions, dispenseMedicine } from "@/app/actions/prescriptions"
import { toast } from "sonner"
import { redirect } from "next/navigation"

interface NursePharmacyDispensePageProps {
  searchParams: {
    prescriptionId?: string
  }
}

export default async function NursePharmacyDispensePage({ searchParams }: NursePharmacyDispensePageProps) {
  const prescriptionId = searchParams.prescriptionId

  if (!prescriptionId) {
    const { prescriptions } = await getPendingPrescriptions()
    
    return (
      <main className="space-y-6">
        <PageHeader
          title="Dispense Medicine"
          description="Select a prescription to dispense."
        />
        {prescriptions.length === 0 ? (
          <div className="text-center text-muted-foreground">
            No pending prescriptions to dispense.
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((presc: any) => (
              <div key={presc.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{presc.medicines?.generic_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Patient: {presc.consultations?.clinic_visits?.students?.first_name} {presc.consultations?.clinic_visits?.students?.last_name}
                    </p>
                  </div>
                  <a
                    href={`/nurse/pharmacy/dispense?prescriptionId=${presc.id}`}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Dispense
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    )
  }

  // Get full prescription details
  const { prescriptions } = await getPendingPrescriptions()
  const prescription = prescriptions.find((p: any) => p.id === prescriptionId)

  if (!prescription) {
    return (
      <main className="space-y-6">
        <PageHeader
          title="Dispense Medicine"
          description="Prescription not found."
        />
        <div className="text-center text-muted-foreground">
          Prescription not found or already dispensed.
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Dispense Medicine"
        description="Dispense medication for the selected prescription."
      />
      <DispensingForm
        prescription={prescription}
        onDispense={async (stockId, quantity) => {
          "use server"
          const result = await dispenseMedicine(prescriptionId, stockId, quantity)
          if (result.error) {
            toast.error(result.error)
            throw new Error(result.error)
          }
          toast.success("Medicine dispensed successfully")
          redirect("/nurse/pharmacy/dispense")
        }}
      />
    </main>
  )
}