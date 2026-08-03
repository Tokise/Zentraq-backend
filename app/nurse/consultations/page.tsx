import { ConsultationQueuePage } from "@/components/workflow/queue-pages"
export default function NurseConsultationsPage() { return <ConsultationQueuePage title="Active Consultations" description="Current clinic consultations." statuses={["in-progress"]} /> }
