"use client"

import { ClinicAnnouncementsWorkspace } from "@/components/communication/clinic-announcements-workspace"
import { PageHeader } from "@/components/common/page-header"

export default function StaffAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Health clinic announcements, policy notices, and updates."
        title="Announcements"
      />
      <ClinicAnnouncementsWorkspace />
    </div>
  )
}