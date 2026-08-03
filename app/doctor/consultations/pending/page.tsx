import { ConsultationQueuePage } from "@/components/workflow/queue-pages"
export default function PendingConsultationsPage() { return <ConsultationQueuePage title="Pending Review" description="Consultations awaiting medical review." statuses={["in-progress"]} /> }
