import { AppointmentQueuePage } from "@/components/workflow/queue-pages"
export default function DoctorAppointmentsPage() {
  return (
    <AppointmentQueuePage
      title="My Schedule"
      description="Appointments scheduled for clinic care."
      statuses={["scheduled", "reminded", "checked_in"]}
    />
  )
}
