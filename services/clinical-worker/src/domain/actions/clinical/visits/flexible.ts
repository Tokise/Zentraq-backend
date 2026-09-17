import { z } from "zod";
import { createClient } from "../../../../runtime/context.js";
import { updateTag } from "../../../../runtime/effects.js";

const uuid = z.string().uuid();
const vital = z.enum(["temperature", "blood_pressure", "heart_rate", "respiratory_rate", "oxygen_saturation"]);
const visitor = z.object({
  first_name: z.string().trim().min(1).max(150),
  last_name: z.string().trim().max(150).default(""),
  category: z.enum(["parent", "guardian", "visitor"]),
  birth_date: z.string().date().optional(),
  age_years: z.number().int().min(0).max(130).optional(),
  phone: z.string().trim().max(30).optional(),
}).strict();
const manualVisit = z.object({
  request_id: uuid,
  patient_type: z.enum(["student", "faculty", "staff", "visitor"]),
  patient_id: uuid.optional(),
  clinician_id: uuid.optional(),
  complaint: z.string().trim().min(1).max(120),
  visitor: visitor.optional(),
}).strict().refine((value) => Boolean(value.patient_id) || (value.patient_type === "visitor" && Boolean(value.visitor)));

export const protocolRules = z.object({
  case_description: z.string().trim().min(3).max(2000),
  eligibility: z.array(z.string().trim().min(3).max(300)).min(1).max(20),
  exclusions: z.array(z.string().trim().min(3).max(300)).min(1).max(20),
  escalation: z.string().trim().min(3).max(2000),
  required_vitals: z.array(vital).max(5),
  min_age: z.number().int().min(0).max(130),
  max_age: z.number().int().min(0).max(130),
  medicines: z.array(z.object({
    medicine_id: uuid,
    dosage: z.string().trim().min(1).max(100),
    frequency: z.string().trim().min(1).max(100),
    max_quantity: z.number().int().min(1).max(1000),
    max_duration_days: z.number().int().min(1).max(365),
  }).strict()).min(1).max(20),
}).strict().refine((r) => r.min_age <= r.max_age);

// Executes only a server-selected database function with authenticated JWT context.
async function rpc(name: string, params: Record<string, unknown>) {
  const { data, error } = await createClient().rpc(name, params);
  if (error) throw new Error(error.message);
  return data;
}

// Searches minimized patient identities for an active clinical user.
export function searchManualVisitPatientsAction(input: unknown) {
  return rpc("search_manual_visit_patients", { p_search: z.string().max(100).parse(input) });
}

// Creates visitor identity and its first encounter in one database transaction.
export async function createManualVisitAction(input: unknown) {
  const id = await rpc("create_manual_visit", { p_input: manualVisit.parse(input) });
  updateTag("consultations");
  return id;
}

// Loads configuration and, when requested, assignment-protected consultation context.
export function getWorkflowSupportAction(input: unknown) {
  return rpc("get_workflow_support", { p_id: uuid.nullable().parse(input) });
}

// Records a retry-safe contact, review, or nurse-assistance milestone.
export function recordCoordinationAction(input: unknown) {
  const parsed = z.object({
    consultation_id: uuid,
    request_id: uuid,
    milestone: z.enum(["patient_contact_pending", "patient_contact_completed", "doctor_review_requested",
      "patient_doctor_discussion_completed", "outcome_recorded", "nurse_assigned", "nurse_acknowledged"]),
    note: z.string().trim().max(1000).default(""),
    nurse_id: uuid.optional(),
  }).strict().parse(input);
  return rpc("record_consultation_coordination", { p_input: parsed });
}

// Separates doctor authorship and approval from administrator activation.
export function manageClinicalProtocolAction(input: unknown) {
  const parsed = z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("create"), title: z.string().trim().min(3).max(150),
      version: z.number().int().positive(), expires_at: z.string().datetime(), rules: protocolRules }).strict(),
    z.object({ operation: z.literal("approve"), id: uuid }).strict(),
    z.object({ operation: z.literal("enable"), id: uuid, enabled: z.boolean() }).strict(),
    z.object({ operation: z.literal("profile"), title: z.string().trim().min(3).max(150),
      vital_keys: z.array(vital).max(5) }).strict(),
  ]).parse(input);
  return rpc("manage_clinical_protocol", { p_input: parsed });
}

// Lists metadata-only assistance tasks for the current clinician.
export function getClinicCoordinationQueueAction() {
  return rpc("get_clinic_coordination_queue", {});
}

// Claims nursing assistance without stealing another nurse's assignment.
export function claimNurseAssistanceAction(input: unknown) {
  return rpc("claim_nurse_assistance", { p_id: uuid.parse(input) });
}

// Requests clearance for an owned encounter without granting an evaluation result.
export function requestConsultationClearanceAction(input: unknown) {
  const parsed = z.object({ consultation_id: uuid, purpose: z.string().trim().min(3).max(500) }).strict().parse(input);
  return rpc("request_consultation_clearance", { p_id: parsed.consultation_id, p_purpose: parsed.purpose });
}

// Reads or changes the current nurse's expiring assistance availability.
export function nurseDutyStatusAction(input: unknown = null) {
  return rpc("nurse_duty_status", { p_on_duty: z.boolean().nullable().parse(input) });
}
