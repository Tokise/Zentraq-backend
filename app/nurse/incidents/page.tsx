export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

import { IncidentQueuePage } from "@/components/workflow/queue-pages"
export default function NurseIncidentsPage() { return <IncidentQueuePage title="Case Management" /> }
