"use client";

import { MedicalRecordsViewPage } from "@/app/admin/records/view/page";

// Shows the unified medical-record workspace without document-upload access.
export default function DoctorRecordsViewPage() {
  return <MedicalRecordsViewPage canUpload={false} />;
}
