"use server";

import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

type DraftStep =
  | "details"
  | "vitals"
  | "notes"
  | "diagnosis"
  | "prescription"
  | "follow_up"
  | "review";

interface ConsultationDraft {
  current_step: DraftStep;
  draft_data: Record<string, unknown>;
  updated_at: string;
}

export type ConsultationWizardState = {
  chiefComplaint?: string;
  vitals?: Record<string, string>;
  vitalsDecision?: "required" | "not_required";
  vitalsSkipReason?: string;
  outcomeNote?: string;
  diagnosis?: { icd10_code: string; description: string };
  prescription?: {
    medicine_id: string;
    dosage: string;
    frequency: string;
    quantity: string;
  };
  followUp?: { scheduled_date: string; reason: string };
};

// Reads a protected consultation draft for an authorized clinical operator.
export async function getConsultationDraft(consultationId: string) {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) {
    return { error: "Access denied", draft: null as ConsultationDraft | null };
  }

  const { data, error } = await createAdminClient()
    .from("consultation_drafts")
    .select("current_step, draft_data, updated_at")
    .eq("consultation_id", consultationId)
    .maybeSingle();

  return {
    error: error?.message ?? null,
    draft: data as ConsultationDraft | null,
  };
}

// Saves one resumable wizard snapshot after server-side authorization checks.
export async function saveConsultationDraft(
  consultationId: string,
  currentStep: DraftStep,
  draftData: Record<string, unknown>,
) {
  const actor = await getActionActor();
  if (
    !actor ||
    !hasAnyRole(actor, ["admin", "doctor", "nurse"]) ||
    !(await assertSameOrigin())
  ) {
    return { error: "Access denied" };
  }

  const { error } = await createAdminClient()
    .from("consultation_drafts")
    .upsert({
      consultation_id: consultationId,
      current_step: currentStep,
      draft_data: draftData,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    });

  return { error: error?.message ?? null };
}

// Saves one typed wizard snapshot through the existing protected draft store.
export async function saveConsultationWizardState(
  consultationId: string,
  currentStep: DraftStep,
  state: ConsultationWizardState,
) {
  return saveConsultationDraft(consultationId, currentStep, state);
}

// Removes the draft only after the consultation is finalized.
export async function clearConsultationDraft(consultationId: string) {
  const actor = await getActionActor();
  if (
    !actor ||
    !hasAnyRole(actor, ["admin", "doctor", "nurse"]) ||
    !(await assertSameOrigin())
  ) {
    return { error: "Access denied" };
  }

  const { error } = await createAdminClient()
    .from("consultation_drafts")
    .delete()
    .eq("consultation_id", consultationId);

  return { error: error?.message ?? null };
}
