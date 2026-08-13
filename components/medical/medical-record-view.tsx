"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SensitiveField } from "@/components/common/sensitive-field";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Droplet,
  IdCard,
} from "lucide-react";
import { PatientClinicalSectionGrid } from "./patient-clinical-section-grid";
import type { PatientMedicalRecord } from "@/actions/clinical/records/patient-records";

interface MedicalRecordViewProps {
  record: PatientMedicalRecord;
  canEdit: boolean;
  onUpdated?: () => Promise<void> | void;
  profilePhotoUrl?: string | null;
}

// Renders a patient profile with reusable clinical summary cards.
export function MedicalRecordView({
  record,
  canEdit,
  onUpdated,
  profilePhotoUrl,
}: MedicalRecordViewProps) {
  const photoUrl = record.profile_photo_url ?? profilePhotoUrl;

  return (
    <div className="space-y-6">
      {/* Patient Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
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
                  {record.first_name[0]}
                  {record.last_name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">
                  <SensitiveField
                    value={`${record.first_name} ${record.middle_name ? record.middle_name + " " : ""}${record.last_name}`}
                  />
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {record.patient_type === "student" ? "Student" : "Faculty"}
                  </Badge>
                  {record.patient_type === "student" && record.year_level && (
                    <Badge variant="secondary">
                      {record.year_level}
                      {record.section ? ` - ${record.section}` : ""}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <IdCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">ID:</span>
                  <SensitiveField value={record.identifier} />
                </div>

                {record.patient_type === "student" && record.course && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Course:</span>
                    <SensitiveField value={record.course} />
                  </div>
                )}

                {record.department && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Department:</span>
                    <SensitiveField value={record.department} />
                  </div>
                )}

                {record.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <SensitiveField value={record.email} />
                  </div>
                )}

                {record.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Phone:</span>
                    <SensitiveField value={record.phone} />
                  </div>
                )}

                {record.birth_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">DOB:</span>
                    <SensitiveField
                      value={new Date(record.birth_date).toLocaleDateString()}
                    />
                  </div>
                )}

                {record.blood_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <Droplet className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Blood Type:</span>
                    <SensitiveField value={record.blood_type} />
                  </div>
                )}

                {record.gender && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Gender:</span>
                    <SensitiveField value={record.gender} />
                  </div>
                )}
              </div>

              {(record.emergency_contact_name ||
                record.emergency_contact_phone) && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Emergency Contact</p>
                  <div className="flex items-center gap-4 text-sm">
                    {record.emergency_contact_name && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <SensitiveField value={record.emergency_contact_name} />
                      </div>
                    )}
                    {record.emergency_contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <SensitiveField
                          value={record.emergency_contact_phone}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {record.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <SensitiveField value={record.address} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <PatientClinicalSectionGrid
        record={record}
        canEdit={canEdit}
        onUpdated={onUpdated}
      />
    </div>
  );
}
