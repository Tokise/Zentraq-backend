"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAuditEvent } from "@/lib/audit-logger";
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";

const ReceiveMedicineStockSchema = z.object({
  requestId: z.string().uuid(),
  medicineId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1_000_000),
  batchNumber: z.string().trim().min(1).max(100),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().trim().max(100).optional(),
});

type StockRole = "admin" | "nurse";

// Resolves an authenticated clinic operator permitted to receive stock.
async function stockActor(roles: readonly StockRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

// Returns today's date in the clinic timezone for expiry validation.
function clinicDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Records one traceable stock receipt for an active approved medicine.
export async function receiveMedicineStockAction(input: unknown): Promise<{
  error: string | null;
  stockId: string | null;
}> {
  const actor = await stockActor(["admin", "nurse"]);
  if (!actor || !(await assertSameOrigin())) {
    return { error: "Access denied", stockId: null };
  }

  const parsed = ReceiveMedicineStockSchema.safeParse(input);
  if (!parsed.success || parsed.data.expiryDate <= clinicDate()) {
    return {
      error: "Enter a valid quantity, batch number, and future expiry date",
      stockId: null,
    };
  }

  const admin = createAdminClient();
  const { data: medicine, error: medicineError } = await admin
    .from("medicines")
    .select("id,is_active,approval_status")
    .eq("id", parsed.data.medicineId)
    .maybeSingle();

  if (
    medicineError ||
    !medicine ||
    !medicine.is_active ||
    medicine.approval_status !== "approved"
  ) {
    return { error: "Medicine is unavailable for restocking", stockId: null };
  }

  const stockReceipt = {
    id: parsed.data.requestId,
    medicine_id: parsed.data.medicineId,
    quantity: parsed.data.quantity,
    batch_number: parsed.data.batchNumber,
    expiry_date: parsed.data.expiryDate,
    location: parsed.data.location || null,
    updated_at: new Date().toISOString(),
  };
  const { data: stock, error: stockError } = await admin
    .from("medicine_stock")
    .insert(stockReceipt)
    .select("id")
    .single();

  if (stockError?.code === "23505") {
    const { data: existing } = await admin
      .from("medicine_stock")
      .select("id,medicine_id,quantity,batch_number,expiry_date,location")
      .eq("id", parsed.data.requestId)
      .maybeSingle();
    const matchesRequest =
      existing?.medicine_id === stockReceipt.medicine_id &&
      existing.quantity === stockReceipt.quantity &&
      existing.batch_number === stockReceipt.batch_number &&
      existing.expiry_date === stockReceipt.expiry_date &&
      (existing.location ?? null) === stockReceipt.location;

    if (matchesRequest) {
      return { error: null, stockId: existing.id };
    }
  }

  if (stockError || !stock) {
    return { error: "Unable to receive medicine stock", stockId: null };
  }

  await logAuditEvent({
    action: "INVENTORY_MODIFICATION",
    userId: actor.id,
    email: actor.email,
    resource: stock.id,
    details: {
      operation: "stock_received",
      medicineId: parsed.data.medicineId,
      quantity: parsed.data.quantity,
    },
  });

  revalidatePath("/admin/medicine/stock");
  revalidatePath("/admin/medicine/restock");
  revalidatePath("/nurse/medicine/stock");
  revalidatePath("/nurse/medicine/restock");
  revalidatePath("/doctor/medicine/stock");
  revalidatePath("/admin/visits");
  revalidatePath("/doctor/visits");

  return { error: null, stockId: stock.id };
}
