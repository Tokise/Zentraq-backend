import { redirect } from "next/navigation"

// Consolidates participant management into the database-backed enrollment route.
export default function AdminHealthProgramParticipantsPage() {
  redirect("/admin/healthprograms/enrollment")
}
