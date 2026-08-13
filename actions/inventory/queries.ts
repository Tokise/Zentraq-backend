"use server";

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

export interface InventoryMedicine {
  id: string;
  name: string;
  stock: number;
  minimum: number;
  unit: string;
  expiry: string | null;
}

// Returns every active approved medicine, including products with no stock rows.
export async function getInventoryQueueAction() {
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) {
    return {
      error: "Access denied",
      medicines: [] as InventoryMedicine[],
    };
  }

  const admin = createAdminClient();
  const { data: medicines, error } = await admin
    .from("medicines")
    .select(
      "id,generic_name,brand_name,unit,min_stock_level,is_active,approval_status",
    )
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("generic_name")
    .limit(500);

  if (error) {
    return {
      error: "Unable to load medicine inventory",
      medicines: [] as InventoryMedicine[],
    };
  }

  const medicineIds = (medicines ?? []).map((medicine) => medicine.id);
  const stockByMedicine = new Map<string, number>();
  const expiryByMedicine = new Map<string, string>();

  if (medicineIds.length > 0) {
    const { data: stockRows, error: stockError } = await admin
      .from("medicine_stock")
      .select("medicine_id,quantity,expiry_date")
      .in("medicine_id", medicineIds);

    if (stockError) {
      return {
        error: "Unable to load medicine inventory",
        medicines: [] as InventoryMedicine[],
      };
    }

    for (const stockRow of stockRows ?? []) {
      const quantity = Number(stockRow.quantity ?? 0);
      stockByMedicine.set(
        stockRow.medicine_id,
        (stockByMedicine.get(stockRow.medicine_id) ?? 0) + quantity,
      );

      if (quantity <= 0 || !stockRow.expiry_date) continue;
      const currentExpiry = expiryByMedicine.get(stockRow.medicine_id);
      if (!currentExpiry || stockRow.expiry_date < currentExpiry) {
        expiryByMedicine.set(stockRow.medicine_id, stockRow.expiry_date);
      }
    }
  }

  return {
    error: null,
    medicines: (medicines ?? []).map((medicine) => ({
      id: medicine.id,
      name: medicine.brand_name
        ? `${medicine.generic_name} (${medicine.brand_name})`
        : medicine.generic_name,
      stock: stockByMedicine.get(medicine.id) ?? 0,
      minimum: medicine.min_stock_level ?? 0,
      unit: medicine.unit,
      expiry: expiryByMedicine.get(medicine.id) ?? null,
    })),
  };
}
