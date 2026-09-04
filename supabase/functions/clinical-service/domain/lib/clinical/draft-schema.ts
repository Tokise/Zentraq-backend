import { z } from "npm:zod@4.4.3";

const text = z.string().max(4000);
export const consultationDraftSchema = z.object({
  version: z.literal(1),
  step: z.enum([
    "handoff",
    "details",
    "vitals",
    "notes",
    "doctor_selection",
    "clinical_plan",
    "review",
  ]),
  patientComplaint: text,
  customPatientComplaint: text,
  vitalsDisposition: z.enum(["required", "not_required", "existing", ""]),
  skipReasonChoice: text,
  customSkipReason: text,
  vitals: z.object({
    temperature: text,
    blood_pressure: text,
    heart_rate: text,
    respiratory_rate: text,
    oxygen_saturation: text,
  }).strict(),
  notes: text,
  diagnosisEnabled: z.boolean(),
  diagnosisSelection: text,
  diagnosisCode: text,
  diagnosisDescription: text,
  treatmentEnabled: z.boolean(),
  treatmentPlan: text,
  treatmentInstructions: text,
  prescriptionEnabled: z.boolean(),
  prescription: z.object({
    medicine_id: text,
    dosage: text,
    frequency: text,
    duration_days: text,
    quantity: text,
    instructions: text,
  }).strict(),
  followUpEnabled: z.boolean(),
  followUpDate: text,
  selectedReviewDoctorId: text,
}).strict();

export type ConsultationDraft = z.infer<typeof consultationDraftSchema>;
