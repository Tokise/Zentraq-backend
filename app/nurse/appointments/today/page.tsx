import { AppointmentQueuePage } from "@/components/workflow/queue-pages"
export default function TodayAppointmentsPage() { return <AppointmentQueuePage title="Today's Schedule" description="Scheduled and checked-in appointments." statuses={["scheduled", "reminded", "checked_in", "in_consultation"]} /> }
