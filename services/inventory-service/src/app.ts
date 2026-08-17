import type { Express } from "express";
import { z } from "zod";

import {
  AppError,
  asyncRoute,
  createAdminClient,
  createServiceApp,
  errorHandler,
  notFoundHandler,
  paginationMeta,
  paginationRange,
  paginationSchema,
  requireInternalContext,
  requireRoles,
  requireStrongSecret,
  sendCollection,
  sendData,
  serviceRequest,
  type AuthContext,
} from "@zentraq/shared";

const receiveStockSchema = z.object({
  batchNumber: z.string().trim().min(1).max(100),
  expiryDate: z.iso.date(),
  location: z.string().trim().max(100).optional().nullable(),
  medicineId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1_000_000),
  requestId: z.string().uuid(),
});

const dispenseSchema = z.object({
  prescriptionId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10_000),
  requestId: z.string().uuid(),
  stockId: z.string().uuid(),
});

interface InventoryDependencies {
  contextSecret?: string;
  internalServiceKey?: string;
  reportingServiceUrl?: string;
  timeoutMs?: number;
}

// Creates Inventory Service as the only backend owner of stock mutations.
export function createInventoryApp(
  dependencies: InventoryDependencies = {},
): Express {
  const app = createServiceApp("inventory-service");
  const contextSecret =
    dependencies.contextSecret ??
    requireStrongSecret(process.env.INTERNAL_CONTEXT_SECRET, "INTERNAL_CONTEXT_SECRET");
  const internalServiceKey =
    dependencies.internalServiceKey ??
    requireStrongSecret(process.env.INTERNAL_SERVICE_KEY, "INTERNAL_SERVICE_KEY");
  const reportingServiceUrl =
    dependencies.reportingServiceUrl ??
    process.env.REPORTING_SERVICE_URL ??
    "http://localhost:4006";
  const timeoutMs = dependencies.timeoutMs ?? Number(process.env.SERVICE_TIMEOUT_MS ?? 8_000);

  app.use("/api/v1", requireInternalContext(contextSecret));

  app.get(
    "/api/v1/inventory/stock",
    requireRoles("admin", "doctor", "nurse"),
    asyncRoute(async (_request, response) => {
      const admin = createAdminClient();
      const { data: medicines, error } = await admin
        .from("medicines")
        .select("id,generic_name,brand_name,unit,min_stock_level")
        .eq("is_active", true)
        .eq("approval_status", "approved")
        .order("generic_name")
        .limit(500);
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load inventory.");
      const medicineIds = (medicines ?? []).map((medicine) => medicine.id);
      const { data: stockRows, error: stockError } = medicineIds.length
        ? await admin
            .from("medicine_stock")
            .select("id,medicine_id,quantity,batch_number,expiry_date,location")
            .in("medicine_id", medicineIds)
        : { data: [], error: null };
      if (stockError) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load inventory.");
      const grouped = new Map<string, { earliestExpiry: string | null; quantity: number }>();
      for (const row of stockRows ?? []) {
        const current = grouped.get(row.medicine_id) ?? {
          earliestExpiry: null,
          quantity: 0,
        };
        current.quantity += Number(row.quantity ?? 0);
        if (
          Number(row.quantity ?? 0) > 0 &&
          row.expiry_date &&
          (!current.earliestExpiry || row.expiry_date < current.earliestExpiry)
        ) {
          current.earliestExpiry = row.expiry_date;
        }
        grouped.set(row.medicine_id, current);
      }
      sendData(
        response,
        (medicines ?? []).map((medicine) => {
          const stock = grouped.get(medicine.id) ?? { earliestExpiry: null, quantity: 0 };
          return {
            earliestExpiry: stock.earliestExpiry,
            id: medicine.id,
            minimum: medicine.min_stock_level ?? 0,
            name: medicine.brand_name
              ? `${medicine.generic_name} (${medicine.brand_name})`
              : medicine.generic_name,
            stock: stock.quantity,
            unit: medicine.unit,
          };
        }),
      );
    }),
  );

  app.post(
    "/api/v1/inventory/restock",
    requireRoles("admin", "nurse"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const parsed = receiveStockSchema.safeParse(request.body);
      if (!parsed.success || parsed.data.expiryDate <= clinicDate()) {
        throw new AppError(400, "VALIDATION_ERROR", "Enter a future expiry and valid stock details.");
      }
      const admin = createAdminClient();
      const { data: medicine, error: medicineError } = await admin
        .from("medicines")
        .select("id,is_active,approval_status")
        .eq("id", parsed.data.medicineId)
        .maybeSingle();
      if (medicineError) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to validate medicine.");
      if (!medicine?.is_active || medicine.approval_status !== "approved") {
        throw new AppError(409, "MEDICINE_UNAVAILABLE", "Medicine is unavailable for restocking.");
      }
      const receipt = {
        batch_number: parsed.data.batchNumber,
        expiry_date: parsed.data.expiryDate,
        id: parsed.data.requestId,
        location: parsed.data.location ?? null,
        medicine_id: parsed.data.medicineId,
        quantity: parsed.data.quantity,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("medicine_stock")
        .insert(receipt)
        .select("id,medicine_id,quantity,batch_number,expiry_date,location")
        .single();
      if (error?.code === "23505") {
        const { data: existing } = await admin
          .from("medicine_stock")
          .select("id,medicine_id,quantity,batch_number,expiry_date,location")
          .eq("id", parsed.data.requestId)
          .maybeSingle();
        if (existing && sameReceipt(existing, receipt)) {
          sendData(response, existing);
          return;
        }
      }
      if (error || !data) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to receive stock.");
      void auditInventory(
        auth,
        data.id,
        "RESTOCK_MEDICINE",
        reportingServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      sendData(response, data, 201);
    }),
  );

  app.post(
    "/api/v1/inventory/dispense",
    requireRoles("admin", "nurse"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const parsed = dispenseSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid dispensing request.");
      const { data, error } = await createAdminClient().rpc("dispense_medicine_v1", {
        requested_by: auth.userId,
        requested_idempotency_key: parsed.data.requestId,
        requested_prescription_id: parsed.data.prescriptionId,
        requested_quantity: parsed.data.quantity,
        requested_stock_id: parsed.data.stockId,
      });
      if (error || typeof data !== "string") {
        const conflict = error?.message.includes("INSUFFICIENT_STOCK") ||
          error?.message.includes("INVALID_PRESCRIPTION_STATE");
        throw new AppError(
          conflict ? 409 : 503,
          conflict ? "DISPENSING_CONFLICT" : "DATABASE_UNAVAILABLE",
          conflict ? "The medicine cannot be dispensed in its current state." : "Unable to dispense medicine.",
        );
      }
      void auditInventory(
        auth,
        data,
        "DISPENSE_MEDICINE",
        reportingServiceUrl,
        internalServiceKey,
        timeoutMs,
      );
      sendData(response, { dispensingId: data }, 201);
    }),
  );

  app.get(
    "/api/v1/inventory/dispensing",
    requireRoles("admin", "doctor", "nurse"),
    asyncRoute(async (request, response) => {
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid pagination.");
      const { from, to } = paginationRange(parsed.data.page, parsed.data.limit);
      const { data, count, error } = await createAdminClient()
        .from("dispensing_logs")
        .select("id,prescription_id,medicine_stock_id,dispensed_by,quantity,dispensed_at", {
          count: "exact",
        })
        .order("dispensed_at", { ascending: false })
        .range(from, to);
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load dispensing logs.");
      sendCollection(
        response,
        data ?? [],
        paginationMeta(parsed.data.page, parsed.data.limit, count ?? 0),
      );
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Requires the signed gateway context for inventory mutations.
function authenticated(context: AuthContext | undefined): AuthContext {
  if (!context) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return context;
}

// Returns the current date in the clinic timezone.
function clinicDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Compares an idempotent stock retry with its original stored receipt.
function sameReceipt(
  existing: {
    batch_number: string | null;
    expiry_date: string | null;
    location: string | null;
    medicine_id: string;
    quantity: number;
  },
  requested: {
    batch_number: string;
    expiry_date: string;
    location: string | null;
    medicine_id: string;
    quantity: number;
  },
): boolean {
  return (
    existing.batch_number === requested.batch_number &&
    existing.expiry_date === requested.expiry_date &&
    existing.location === requested.location &&
    existing.medicine_id === requested.medicine_id &&
    existing.quantity === requested.quantity
  );
}

// Writes a sanitized inventory event without rolling back the stock operation.
async function auditInventory(
  auth: AuthContext,
  entityId: string,
  action: string,
  reportingUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await serviceRequest(`${reportingUrl}/internal/audit`, {
      body: {
        action,
        entityId,
        entityType: "inventory",
        metadata: { source: "inventory-service" },
        userId: auth.userId,
      },
      requestId: auth.requestId,
      serviceKey,
      timeoutMs,
    });
  } catch {
    console.error(
      JSON.stringify({
        code: "AUDIT_WRITE_FAILED",
        event: "audit_write_failed",
        requestId: auth.requestId,
        service: "inventory-service",
      }),
    );
  }
}
