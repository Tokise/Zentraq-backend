"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard";
import { CreateMedicineSchema } from "@/lib/validation/schemas";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

type CatalogRole = "admin" | "nurse";

const CatalogItemSchema = CreateMedicineSchema.extend({
  id: z.string().uuid().nullable().optional(),
});

const CatalogReviewSchema = z.object({
  id: z.string().uuid(),
  approved: z.boolean(),
});

export interface MedicineCatalogItem {
  id: string;
  genericName: string;
  brandName: string | null;
  category: string | null;
  unit: string;
  minimumStock: number;
  availableStock: number;
  isControlled: boolean;
  isActive: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
}

// Returns the authenticated actor when they hold a catalog-management role.
async function catalogActor(roles: readonly CatalogRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

// Lists catalog products with aggregate stock and approval state.
export async function getMedicineCatalogItemsAction(): Promise<{
  error: string | null;
  medicines: MedicineCatalogItem[];
}> {
  const actor = await catalogActor(["admin", "nurse"]);
  if (!actor) return { error: "Access denied", medicines: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("medicines")
    .select(
      "id,generic_name,brand_name,category,unit,min_stock_level,is_controlled,is_active,approval_status",
    )
    .order("generic_name")
    .limit(500);
  if (error) return { error: "Unable to load medicine catalog", medicines: [] };

  const medicineIds = (data ?? []).map((medicine) => medicine.id);
  const stockByMedicine = new Map<string, number>();
  if (medicineIds.length > 0) {
    const { data: stock } = await admin
      .from("medicine_stock")
      .select("medicine_id,quantity")
      .in("medicine_id", medicineIds);
    for (const row of stock ?? []) {
      stockByMedicine.set(
        row.medicine_id,
        (stockByMedicine.get(row.medicine_id) ?? 0) + row.quantity,
      );
    }
  }

  return {
    error: null,
    medicines: (data ?? []).map((medicine) => ({
      id: medicine.id,
      genericName: medicine.generic_name,
      brandName: medicine.brand_name,
      category: medicine.category,
      unit: medicine.unit,
      minimumStock: medicine.min_stock_level ?? 0,
      availableStock: stockByMedicine.get(medicine.id) ?? 0,
      isControlled: medicine.is_controlled ?? false,
      isActive: medicine.is_active ?? false,
      approvalStatus: medicine.approval_status,
    })),
  };
}

// Creates or edits a medicine while deriving approval state in the database.
export async function saveMedicineCatalogItemAction(input: unknown): Promise<{
  error: string | null;
  id: string | null;
}> {
  const actor = await catalogActor(["admin", "nurse"]);
  if (!actor || !(await assertSameOrigin())) {
    return { error: "Access denied", id: null };
  }

  const parsed = CatalogItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid medicine values", id: null };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("save_medicine_catalog_item", {
    requested_id: parsed.data.id ?? null,
    requested_generic_name: parsed.data.generic_name,
    requested_brand_name: parsed.data.brand_name ?? "",
    requested_category: parsed.data.category ?? "",
    requested_unit: parsed.data.unit,
    requested_min_stock_level: parsed.data.min_stock_level,
    requested_is_controlled: parsed.data.is_controlled,
    requested_is_active: parsed.data.is_active,
  });

  if (error || typeof data !== "string") {
    return {
      error: error?.message ?? "Unable to save medicine",
      id: null,
    };
  }

  return { error: null, id: data };
}

// Approves or rejects one pending controlled medicine as an Admin.
export async function reviewMedicineCatalogItemAction(
  input: unknown,
): Promise<{ error: string | null }> {
  const actor = await catalogActor(["admin"]);
  if (!actor || !(await assertSameOrigin())) return { error: "Access denied" };
  const parsed = CatalogReviewSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid review request" };

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("review_medicine_catalog_item", {
    requested_id: parsed.data.id,
    requested_approved: parsed.data.approved,
  });
  return { error: error?.message ?? null };
}

