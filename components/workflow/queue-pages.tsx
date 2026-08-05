import { PageHeader } from "@/components/page-header"
import { QueueTable } from "@/components/workflow/queue-table"
import { getAppointmentQueue, getClearanceQueue, getConsultationQueue, getIncidentQueue, getInventoryQueue } from "@/actions/inventory/workflow-queries"

export async function AppointmentQueuePage({ title, description, statuses }: { title: string; description: string; statuses?: string[] }) {
  const result = await getAppointmentQueue(statuses)
  return <main className="space-y-6"><PageHeader title={title} description={description} /><QueueTable columns={["Patient", "Reason", "Priority", "Schedule", "Status"]} emptyMessage={result.error ?? "No appointments match this view."} rows={result.appointments.map((item) => ({ id: item.id, values: [item.patient_name, item.reason, item.priority?.toString() ?? "", item.scheduled_date ? `${item.scheduled_date} ${item.scheduled_time ?? ""}` : "Unscheduled", item.status] }))} /></main>
}

export async function ConsultationQueuePage({ title, description, statuses }: { title: string; description: string; statuses?: string[] }) {
  const result = await getConsultationQueue(statuses)
  return (
    <main className="space-y-6 max-w-6xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader title={title} description={description} />
      <QueueTable
        columns={["Patient", "Complaint", "Doctor", "Checked in", "Status", "Actions"]}
        emptyMessage={result.error ?? "No consultations match this view."}
        rows={result.consultations.map((item) => ({
          id: item.id,
          values: [item.patient_name, item.complaint, item.doctor_name ?? "â€”", new Date(item.check_in_time).toLocaleString(), item.status],
        }))}
      />
    </main>
  )
}

export async function InventoryQueuePage({ alertsOnly = false }: { alertsOnly?: boolean }) {
  const result = await getInventoryQueue(); const medicines = alertsOnly ? result.medicines.filter((item) => item.stock <= item.minimum) : result.medicines
  return <main className="space-y-6"><PageHeader title={alertsOnly ? "Low Stock Alerts" : "Inventory Status"} description={alertsOnly ? "Medicines at or below their configured minimum stock." : "Current medicine stock from all batches."} /><QueueTable columns={["Medicine", "Stock", "Minimum", "Nearest expiry"]} emptyMessage={result.error ?? "No inventory records match this view."} rows={medicines.map((item) => ({ id: item.id, values: [item.name, String(item.stock), String(item.minimum), item.expiry ?? ""] }))} /></main>
}

export async function IncidentQueuePage({ title, includeClosed = false }: { title: string; includeClosed?: boolean }) {
  const result = await getIncidentQueue(includeClosed)
  return <main className="space-y-6"><PageHeader title={title} description="Incident cases recorded in the clinic." /><QueueTable columns={["Description", "Severity", "Status", "Reported"]} emptyMessage={result.error ?? "No incident cases match this view."} rows={result.incidents.map((item) => ({ id: item.id, values: [item.description, item.severity ?? "", item.status, new Date(item.created_at).toLocaleString()] }))} /></main>
}

export async function ClearanceQueuePage({ title, description }: { title: string; description: string }) {
  const result = await getClearanceQueue()
  return <main className="space-y-6"><PageHeader title={title} description={description} /><QueueTable columns={["Requester type", "Purpose", "Status", "Requested"]} emptyMessage={result.error ?? "No clearance requests match this view."} rows={result.clearances.map((item) => ({ id: item.id, values: [item.requester_type, item.purpose ?? "", item.status, new Date(item.created_at).toLocaleString()] }))} /></main>
}
