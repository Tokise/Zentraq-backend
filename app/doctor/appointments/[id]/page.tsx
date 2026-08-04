import { PageHeader } from "@/components/page-header"
import { RecommendationForm } from "@/components/appointment/recommendation-form"
import { getAppointmentDetail, recommendAppointment } from "@/app/actions/appointment-review"
import { notFound } from "next/navigation"
import { toast } from "sonner"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface DoctorAppointmentPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function DoctorAppointmentPage({ params }: DoctorAppointmentPageProps) {
  const { id } = await params
  const { appointment, error } = await getAppointmentDetail(id)
  
  if (error || !appointment) {
    notFound()
  }

  const patient = appointment.students || appointment.faculty
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown"
  const patientId = patient?.student_number || patient?.employee_number || "N/A"

  return (
    <main className="space-y-6">
      <PageHeader
        title="Appointment Review"
        description={`Review appointment for ${patientName} (${patientId})`}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Patient:</span>
                <p className="font-medium">{patientName}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Reason:</span>
                <p className="font-medium">{appointment.reason}</p>
              </div>
              {appointment.symptoms && (
                <div>
                  <span className="text-sm text-muted-foreground">Symptoms:</span>
                  <p className="font-medium">{appointment.symptoms}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">Priority:</span>
                <p className="font-medium">{appointment.priority || "Normal"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant="outline" className="ml-2">{appointment.status}</Badge>
              </div>
              {appointment.scheduled_date && (
                <div>
                  <span className="text-sm text-muted-foreground">Scheduled:</span>
                  <p className="font-medium">
                    {new Date(appointment.scheduled_date).toLocaleDateString()} {appointment.scheduled_time}
                  </p>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">Requested:</span>
                <p>{new Date(appointment.created_at).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          {appointment.appointment_ai_evaluations && appointment.appointment_ai_evaluations.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">AI Evaluation</h3>
                {appointment.appointment_ai_evaluations.map((evaluation: any) => (
                  <div key={evaluation.id} className="bg-muted p-3 rounded text-sm">
                    <div className="flex justify-between mb-1">
                      <span>Priority Score: {evaluation.priority_score}</span>
                    </div>
                    {evaluation.recommended_slot && (
                      <p className="text-muted-foreground">Recommended: {evaluation.recommended_slot}</p>
                    )}
                    {evaluation.rationale && (
                      <p className="text-muted-foreground mt-1">{evaluation.rationale}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {appointment.appointment_recommendations && appointment.appointment_recommendations.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Previous Recommendations</h3>
                {appointment.appointment_recommendations.map((rec: any) => (
                  <div key={rec.id} className="bg-muted p-3 rounded text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium capitalize">{rec.recommendation}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(rec.created_at).toLocaleString()}
                      </span>
                    </div>
                    {rec.recommended_date && (
                      <p className="text-muted-foreground">
                        Rescheduled to: {new Date(rec.recommended_date).toLocaleDateString()} {rec.recommended_time}
                      </p>
                    )}
                    {rec.notes && (
                      <p className="text-muted-foreground mt-1">{rec.notes}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <RecommendationForm
          appointmentId={id}
          onSubmit={async (data) => {
            "use server"
            const result = await recommendAppointment(id, data)
            if (result.error) {
              toast.error(result.error)
              throw new Error(result.error)
            }
            redirect("/doctor/appointments")
          }}
        />
      </div>
    </main>
  )
}
