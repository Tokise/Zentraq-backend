import { AppointmentQueuePage } from "@/components/workflow/queue-pages"
export default function AppointmentRequestsPage() {
    return (
        <AppointmentQueuePage
            title="Appointment Requests"
            description="Requests awaiting AI and staff recommendation."
            statuses={["pending", "ai_evaluated", "recommended"]}
        />
    )
}
