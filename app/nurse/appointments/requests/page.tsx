import { AppointmentQueuePage } from "@/components/workflow/queue-pages"
export default function NurseAppointmentRequestsPage() { return <AppointmentQueuePage title="Appointment Requests" description="Requests ready for clinic review." statuses={["ai_evaluated", "recommended"]} /> }
