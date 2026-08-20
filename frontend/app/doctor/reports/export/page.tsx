import { redirect } from "next/navigation"

// Redirects the legacy Doctor report route to the aggregate analytics workspace.
export default function DoctorReportsExportPage() {
  redirect("/doctor/reports/generate")
}
