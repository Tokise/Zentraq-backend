"use server";

import {
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard";
import { createAdminClient } from "@/utils/supabase/admin";
import { logAuditEvent } from "@/lib/audit-logger";

type StaffRole = "admin" | "doctor" | "nurse";

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor();
  return actor && hasAnyRole(actor, roles) ? actor : null;
}

export interface Medicine {
  id: string;
  generic_name: string;
  brand_name: string | null;
  category: string | null;
  unit: string;
  min_stock_level: number;
  is_controlled: boolean;
  is_active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  available_stock: number;
}

export interface MedicineStock {
  id: string;
  medicine_id: string;
  quantity: number;
  batch_number: string | null;
  expiry_date: string | null;
  location: string | null;
}

export interface Prescription {
  id: string;
  consultation_id: string;
  medicine_id: string;
  dosage: string | null;
  frequency: string | null;
  duration_days: number | null;
  quantity: number | null;
  instructions: string | null;
  prescribed_by: string | null;
  status: string;
  created_at: string;
  medicines: {
    generic_name: string;
    brand_name: string | null;
  };
  consultations: {
    created_at: string;
    clinic_visits: {
      students: {
        student_number: string;
        first_name: string;
        last_name: string;
      } | null;
      faculty: {
        employee_number: string;
        first_name: string;
        last_name: string;
      } | null;
    } | null;
  } | null;
}

export async function getMedicineCatalogAction(filters?: {
  category?: string;
  isControlled?: boolean;
  search?: string;
}) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", medicines: [] as Medicine[] };

  let query = createAdminClient()
    .from("medicines")
    .select(
      "id,generic_name,brand_name,category,unit,min_stock_level,is_controlled,is_active,approval_status",
    )
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("generic_name");

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  if (filters?.isControlled !== undefined) {
    query = query.eq("is_controlled", filters.isControlled);
  }

  if (filters?.search) {
    query = query.or(
      `generic_name.ilike.%${filters.search}%,brand_name.ilike.%${filters.search}%`,
    );
  }

  const { data, error } = await query.limit(100);

  if (error) return { error: error.message, medicines: [] as Medicine[] };

  const medicineIds = (data ?? []).map((medicine) => medicine.id);
  const stockByMedicine = new Map<string, number>();
  if (medicineIds.length > 0) {
    const { data: stock } = await createAdminClient()
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
      ...medicine,
      available_stock: stockByMedicine.get(medicine.id) ?? 0,
    })) as Medicine[],
  };
}

export async function getMedicineStockAction(medicineId?: string) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor) return { error: "Access denied", stock: [] as MedicineStock[] };

  let query = createAdminClient()
    .from("medicine_stock")
    .select("*")
    .gt("quantity", 0)
    .order("expiry_date", { ascending: true });

  if (medicineId) {
    query = query.eq("medicine_id", medicineId);
  }

  const { data, error } = await query;

  if (error) return { error: error.message, stock: [] as MedicineStock[] };

  return { error: null, stock: data as MedicineStock[] };
}

export async function createPrescriptionAction(
  consultationId: string,
  data: {
    medicine_id: string;
    dosage?: string;
    frequency?: string;
    duration_days?: number;
    quantity?: number;
    instructions?: string;
  },
) {
  void consultationId;
  void data;
  return {
    error: "Prescriptions are saved from the consultation final review.",
    prescription: null,
  };
}

export async function getPendingPrescriptionsAction() {
  const actor = await staff(["admin", "nurse"]);
  if (!actor)
    return { error: "Access denied", prescriptions: [] as Prescription[] };

  const { data, error } = await createAdminClient()
    .from("prescriptions")
    .select(
      `
      *,
      medicines!inner(generic_name, brand_name),
      consultations!inner(
        clinic_visits!inner(
          students(student_number, first_name, last_name),
          faculty(employee_number, first_name, last_name)
        )
      )
    `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error)
    return { error: error.message, prescriptions: [] as Prescription[] };

  return { error: null, prescriptions: data as Prescription[] };
}

export async function dispenseMedicineAction(
  prescriptionId: string,
  stockId: string,
  quantity: number,
) {
  const actor = await staff(["admin", "nurse"]);
  if (!actor) return { error: "Access denied", dispensing: null };

  // Verify prescription exists and is pending
  const { data: prescription, error: prescError } = await createAdminClient()
    .from("prescriptions")
    .select("id, status, medicine_id")
    .eq("id", prescriptionId)
    .single();

  if (prescError || !prescription) {
    return { error: "Prescription not found", dispensing: null };
  }

  if (prescription.status !== "pending") {
    return { error: "Prescription is not pending", dispensing: null };
  }

  // Verify stock exists and has sufficient quantity
  const { data: stock, error: stockError } = await createAdminClient()
    .from("medicine_stock")
    .select("id, quantity, medicine_id")
    .eq("id", stockId)
    .single();

  if (stockError || !stock) {
    return { error: "Stock record not found", dispensing: null };
  }

  if (stock.medicine_id !== prescription.medicine_id) {
    return {
      error: "Stock medicine does not match prescription",
      dispensing: null,
    };
  }

  if (stock.quantity < quantity) {
    return { error: "Insufficient stock", dispensing: null };
  }

  // Create dispensing log (trigger will decrement stock)
  const { data: dispensing, error } = await createAdminClient()
    .from("dispensing_logs")
    .insert({
      prescription_id: prescriptionId,
      medicine_stock_id: stockId,
      quantity: quantity,
      dispensed_by: actor.id,
    })
    .select()
    .single();

  if (error) return { error: error.message, dispensing: null };

  // Update prescription status
  await createAdminClient()
    .from("prescriptions")
    .update({ status: "dispensed" })
    .eq("id", prescriptionId);

  await logAuditEvent({
    userId: actor.id,
    action: "INVENTORY_MODIFICATION",
    resource: prescriptionId,
    details: {
      dispensing_id: dispensing.id,
      quantity: quantity,
      stock_id: stockId,
      action: "dispense_medicine",
    },
  });

  return { error: null, dispensing };
}

export async function getPrescriptionHistoryAction(
  patientId: string,
  patientType: "student" | "faculty",
) {
  const actor = await staff(["admin", "doctor", "nurse"]);
  if (!actor)
    return { error: "Access denied", prescriptions: [] as Prescription[] };

  const idColumn = patientType === "student" ? "student_id" : "faculty_id";

  let query = createAdminClient().from("prescriptions").select(`
      *,
      medicines!inner(generic_name, brand_name),
      consultations!inner(
        created_at,
        clinic_visits!inner(
          students(student_number, first_name, last_name),
          faculty(employee_number, first_name, last_name)
        )
      )
    `);

  if (patientId !== "all") {
    query = query.eq(`consultations.clinic_visits.${idColumn}`, patientId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(50);

  if (error)
    return { error: error.message, prescriptions: [] as Prescription[] };

  return { error: null, prescriptions: (data || []) as Prescription[] };
}
