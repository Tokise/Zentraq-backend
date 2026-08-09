import { redirect } from "next/navigation"

// Returns clinicians to the live proposal and program-status workspace.
export default function DoctorHealthProgramParticipantsPage() {
  redirect("/doctor/healthprograms/list")
}
