import { ConsultationQueuePage } from "@/components/workflow/queue-pages"
export default function DoctorConsultationsPage() { return <ConsultationQueuePage title="Active Consultations" description="Consultations currently in progress." statuses={["in-progress"]} /> }
