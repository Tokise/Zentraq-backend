import { PageHeader } from "@/components/page-header"
import { PrescriptionForm } from "@/components/pharmacy/prescription-form"
import { createPrescription } from "@/app/actions/prescriptions"
import { getConsultationQueue } from "@/app/actions/workflow-queries"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Stethoscope, FilePlus, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { redirect } from "next/navigation"
import Link from "next/link"

interface DoctorPrescriptionNewPageProps {
  searchParams: Promise<{
    consultationId?: string
  }>
}

export default async function DoctorPrescriptionsNewPage({ searchParams }: DoctorPrescriptionNewPageProps) {
  const { consultationId } = await searchParams

  if (!consultationId) {
    const { consultations } = await getConsultationQueue(["in_progress", "completed", "checked_in"])

    return (
      <main className="space-y-6 max-w-5xl mx-auto mt-[-25px] px-4 py-4">
        <PageHeader
          title="Write Prescription"
          description="Select an active or recent consultation to issue a medical prescription."
        />

        <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 font-medium text-zinc-900 text-sm">
              <Stethoscope className="size-4 text-blue-600" />
              <span>Select Consultation</span>
            </div>

            {consultations.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <FilePlus className="size-8 text-zinc-300 mx-auto" />
                <p className="text-sm font-medium text-zinc-600">No active consultations found</p>
                <p className="text-xs text-zinc-400">Start a consultation from active consultations or check-in queue first.</p>
                <div className="pt-2">
                  <Link href="/doctor/consultations">
                    <Button variant="outline" size="sm">
                      View Consultations
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-lg overflow-hidden">
                {consultations.map((c) => (
                  <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white hover:bg-zinc-50/80 transition-colors gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 text-sm">{c.patient_name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize bg-blue-50 text-blue-700 border-blue-200">
                          {c.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500">
                        <span className="font-medium text-zinc-700">Complaint:</span> {c.complaint || "Routine Check-in"}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Checked in: {new Date(c.check_in_time).toLocaleString()}
                      </p>
                    </div>

                    <Link href={`/doctor/prescriptions/new?consultationId=${c.id}`}>
                      <Button size="sm" className="bg-zinc-900 hover:bg-zinc-800 text-white shrink-0 gap-1 text-xs">
                        Create Prescription
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="space-y-6 max-w-4xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Write Prescription"
        description="Create a new medical prescription for this consultation."
      />
      <Card className="border-zinc-200/80 shadow-sm bg-white p-6">
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
            redirect(`/doctor/prescriptions`)
          }}
        />
      </Card>
    </main>
  )
}