"use client";

import {
  AlertTriangle,
  ClipboardList,
  Pill,
  Syringe,
} from "lucide-react";

import type { StaffMedicalRecord } from "@/actions/clinical/staff-records";
import { SensitiveField } from "@/components/sensitive-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StaffMedicalRecordViewProps {
  record: StaffMedicalRecord;
  profilePhotoUrl?: string | null;
}

// Renders a staff health record using the same profile-and-section layout as student records.
export function StaffMedicalRecordView({
  record,
  profilePhotoUrl,
}: StaffMedicalRecordViewProps) {
  const { profile } = record;
  const photoUrl = profile.profile_photo_url ?? profilePhotoUrl;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Patient Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-start gap-6">
            <ProfilePhoto
              firstName={profile.first_name}
              lastName={profile.last_name}
              photoUrl={photoUrl}
            />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">
                  <SensitiveField
                    value={`${profile.first_name} ${profile.last_name}`}
                  />
                </h2>
                <Badge className="mt-1" variant="outline">
                  Staff
                </Badge>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
                <ProfileField label="Employee no." value={profile.employee_number} />
                <ProfileField
                  label="Department"
                  value={profile.department ?? "Not recorded"}
                />
                <ProfileField
                  label="Position"
                  value={profile.position ?? "Not recorded"}
                />
                {profile.email && <ProfileField label="Email" value={profile.email} />}
                {profile.phone && <ProfileField label="Phone" value={profile.phone} />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <ClinicalSection
          description={
            record.history.length
              ? `${record.history.length} medical condition${record.history.length === 1 ? "" : "s"} recorded.`
              : "No medical history recorded."
          }
          icon={ClipboardList}
          title="Medical history"
        />
        <ClinicalSection
          description={
            record.allergies.length
              ? `${record.allergies.length} allerg${record.allergies.length === 1 ? "y" : "ies"} recorded.`
              : "No allergies recorded."
          }
          icon={AlertTriangle}
          title="Allergies"
        />
        <ClinicalSection
          description={
            record.medications.length
              ? `${record.medications.length} medication${record.medications.length === 1 ? "" : "s"} recorded.`
              : "No medications recorded."
          }
          icon={Pill}
          title="Medications"
        />
        <ClinicalSection
          description={
            record.immunizations.length
              ? `${record.immunizations.length} immunization${record.immunizations.length === 1 ? "" : "s"} recorded.`
              : "No immunizations recorded."
          }
          icon={Syringe}
          title="Immunizations"
        />
      </div>
    </div>
  );
}

// Renders a square profile photo with initials when no approved image is available.
function ProfilePhoto({
  firstName,
  lastName,
  photoUrl,
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
}) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="size-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {photoUrl ? (
        // Profile images may be signed URLs or validated database data URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Patient profile"
          className="size-full object-cover"
          src={photoUrl}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-2xl text-muted-foreground">
          {initials}
        </div>
      )}
    </div>
  );
}

// Renders a read-only clinical section card consistent with the student record layout.
function ClinicalSection({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof ClipboardList;
  title: string;
}) {
  return (
    <article className="min-h-44 bg-card p-5 text-left shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs text-primary">View details</p>
    </article>
  );
}

// Masks a sensitive profile value until the authorised viewer reveals it.
function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <SensitiveField value={value} />
    </div>
  );
}
