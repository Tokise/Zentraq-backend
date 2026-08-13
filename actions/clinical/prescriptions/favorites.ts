"use server";

import { z } from "zod";

import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

const FavoriteSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  medicineId: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  dosage: z.string().trim().max(100).optional(),
  frequency: z.string().trim().max(100).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  quantity: z.number().int().min(1).max(1000).optional(),
  instructions: z.string().trim().max(1000).optional(),
});

export interface PrescriptionFavorite {
  id: string;
  medicineId: string;
  label: string;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  quantity: number | null;
  instructions: string | null;
}

// Resolves the signed-in Doctor's active clinic account.
async function doctorAccountId(): Promise<string | null> {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["doctor"])) return null;

  const { data } = await createAdminClient()
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", actor.id)
    .eq("role", "doctor")
    .eq("is_active", true)
    .maybeSingle();
  return data?.id ?? null;
}

// Lists reusable prescription favorites owned by the current Doctor.
export async function getPrescriptionFavoritesAction(): Promise<{
  error: string | null;
  favorites: PrescriptionFavorite[];
}> {
  const accountId = await doctorAccountId();
  if (!accountId) return { error: "Access denied", favorites: [] };

  const { data, error } = await createAdminClient()
    .from("doctor_prescription_favorites")
    .select(
      "id,medicine_id,label,dosage,frequency,duration_days,quantity,instructions",
    )
    .eq("doctor_clinic_account_id", accountId)
    .eq("is_active", true)
    .order("label")
    .limit(100);
  if (error) return { error: "Unable to load prescription favorites", favorites: [] };

  return {
    error: null,
    favorites: (data ?? []).map((favorite) => ({
      id: favorite.id,
      medicineId: favorite.medicine_id,
      label: favorite.label,
      dosage: favorite.dosage,
      frequency: favorite.frequency,
      durationDays: favorite.duration_days,
      quantity: favorite.quantity,
      instructions: favorite.instructions,
    })),
  };
}

// Creates or updates one prescription favorite for the current Doctor.
export async function savePrescriptionFavoriteAction(input: unknown): Promise<{
  error: string | null;
  id: string | null;
}> {
  const accountId = await doctorAccountId();
  if (!accountId || !(await assertSameOrigin())) {
    return { error: "Access denied", id: null };
  }
  const parsed = FavoriteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid favorite values", id: null };

  const admin = createAdminClient();
  const { data: medicine } = await admin
    .from("medicines")
    .select("id")
    .eq("id", parsed.data.medicineId)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .maybeSingle();
  if (!medicine) return { error: "Medicine is unavailable", id: null };

  const values = {
    doctor_clinic_account_id: accountId,
    medicine_id: parsed.data.medicineId,
    label: parsed.data.label,
    dosage: parsed.data.dosage || null,
    frequency: parsed.data.frequency || null,
    duration_days: parsed.data.durationDays ?? null,
    quantity: parsed.data.quantity ?? null,
    instructions: parsed.data.instructions || null,
    updated_at: new Date().toISOString(),
  };
  const query = parsed.data.id
    ? admin
        .from("doctor_prescription_favorites")
        .update(values)
        .eq("id", parsed.data.id)
        .eq("doctor_clinic_account_id", accountId)
    : admin.from("doctor_prescription_favorites").insert(values);
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "Unable to save favorite", id: null };
  }
  return { error: null, id: data.id };
}

// Soft-deletes one prescription favorite owned by the current Doctor.
export async function deletePrescriptionFavoriteAction(
  favoriteId: string,
): Promise<{ error: string | null }> {
  const accountId = await doctorAccountId();
  const parsedId = z.string().uuid().safeParse(favoriteId);
  if (!accountId || !parsedId.success || !(await assertSameOrigin())) {
    return { error: "Access denied" };
  }

  const { error } = await createAdminClient()
    .from("doctor_prescription_favorites")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("doctor_clinic_account_id", accountId);
  return { error: error?.message ?? null };
}

