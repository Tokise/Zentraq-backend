import { z } from "npm:zod@4.4.3";
import {
  createClient,
  getActionActor,
  hasAnyRole,
} from "../../../../runtime/context.ts";
import {
  type ConsultationDraft,
  consultationDraftSchema,
} from "../../../lib/clinical/draft-schema.ts";

// Retrieves an owned draft through an assignment-checked database function.
export async function getConsultationDraftAction(
  consultationId: string,
): Promise<{
  draft: ConsultationDraft | null;
  error: string | null;
}> {
  const actor = await getActionActor();
  if (
    !hasAnyRole(actor, ["admin", "doctor", "nurse"]) ||
    !z.uuid().safeParse(consultationId).success
  ) {
    return { draft: null, error: "Access denied" };
  }
  const { data, error } = await createClient().rpc(
    "get_owned_consultation_draft",
    {
      p_consultation_id: consultationId,
    },
  );
  if (error) return { draft: null, error: "Unable to load saved progress" };
  if (!data) return { draft: null, error: null };
  const parsed = consultationDraftSchema.safeParse(data);
  return parsed.success
    ? { draft: parsed.data, error: null }
    : { draft: null, error: "Saved progress needs review before continuing" };
}

// Validates form bounds and persists a draft only while ownership remains active.
export async function saveConsultationDraftAction(
  consultationId: string,
  draft: unknown,
) {
  const actor = await getActionActor();
  const parsed = consultationDraftSchema.safeParse(draft);
  if (
    !hasAnyRole(actor, ["admin", "doctor", "nurse"]) ||
    !z.uuid().safeParse(consultationId).success || !parsed.success
  ) {
    return { success: false, error: "Invalid consultation draft" };
  }
  if (
    actor.role === "nurse" && (parsed.data.diagnosisEnabled ||
      parsed.data.treatmentEnabled || parsed.data.prescriptionEnabled ||
      parsed.data.followUpEnabled)
  ) {
    return {
      success: false,
      error: "Clinical plan requires a Doctor or Admin",
    };
  }
  const { error } = await createClient().rpc("save_owned_consultation_draft", {
    p_consultation_id: consultationId,
    p_draft: parsed.data,
  });
  return error
    ? {
      success: false,
      error: "Unable to save progress. Keep this form open and retry.",
    }
    : { success: true };
}
