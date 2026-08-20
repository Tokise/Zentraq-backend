import type { Express } from "express";
import { z } from "zod";

import {
  AppError,
  asyncRoute,
  createServiceApp,
  errorHandler,
  notFoundHandler,
  requireInternalContext,
  requireRoles,
  requireStrongSecret,
  sendData,
} from "@zentraq/shared";

const slotSchema = z.object({
  clinicianId: z.string().uuid(),
  date: z.iso.date(),
  time: z.iso.time({ precision: -1 }),
});

const appointmentRecommendationInput = z.object({
  availableSlots: z.array(slotSchema).max(100),
  reason: z.string().trim().min(3).max(500),
  symptoms: z.string().trim().max(2_000).optional().nullable(),
});

const appointmentRecommendationOutput = z.object({
  priority: z.number().int().min(1).max(5),
  rationale: z.string().trim().min(1).max(1_000),
  recommendedSlot: slotSchema.nullable(),
});

const inventoryInsightInput = z.object({
  items: z
    .array(
      z.object({
        averageDailyUse: z.number().min(0).max(1_000_000),
        currentStock: z.number().int().min(0).max(1_000_000_000),
        medicineId: z.string().uuid(),
      }),
    )
    .min(1)
    .max(500),
});

const inventoryInsightOutput = z.object({
  insights: z.array(
    z.object({
      medicineId: z.string().uuid(),
      recommendedReorderQuantity: z.number().int().min(0).max(1_000_000_000),
      risk: z.enum(["low", "medium", "high"]),
    }),
  ),
  summary: z.string().trim().min(1).max(1_000),
});

const openRouterResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
      }),
    )
    .min(1),
  model: z.string(),
});

interface AiDependencies {
  contextSecret?: string;
}

// Creates the advisory-only AI Service without database mutation capability.
export function createAiApp(dependencies: AiDependencies = {}): Express {
  const app = createServiceApp("ai-service");
  const contextSecret =
    dependencies.contextSecret ??
    requireStrongSecret(process.env.INTERNAL_CONTEXT_SECRET, "INTERNAL_CONTEXT_SECRET");

  app.use("/api/v1", requireInternalContext(contextSecret));

  app.post(
    "/api/v1/ai/appointments/recommend",
    requireRoles("admin", "doctor", "nurse", "student", "faculty", "staff"),
    asyncRoute(async (request, response) => {
      const parsed = appointmentRecommendationInput.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid scheduling input.");
      const fallback = appointmentFallback(parsed.data);
      const result = await generateStructuredOutput(
        [
          "You are a clinic scheduling decision-support tool.",
          "Return a priority from 1 to 5 and select only a supplied available slot.",
          "Do not diagnose, prescribe, invent a clinician, or invent a time.",
          JSON.stringify(parsed.data),
        ].join("\n"),
        "appointment_recommendation",
        {
          type: "object",
          properties: {
            priority: { type: "integer", minimum: 1, maximum: 5 },
            rationale: { type: "string" },
            recommendedSlot: {
              anyOf: [
                {
                  type: "object",
                  properties: {
                    clinicianId: { type: "string", format: "uuid" },
                    date: { type: "string", format: "date" },
                    time: { type: "string" },
                  },
                  required: ["clinicianId", "date", "time"],
                  additionalProperties: false,
                },
                { type: "null" },
              ],
            },
          },
          required: ["priority", "rationale", "recommendedSlot"],
          additionalProperties: false,
        },
        appointmentRecommendationOutput,
        fallback,
      );
      const allowedSlot =
        !result.data.recommendedSlot ||
        parsed.data.availableSlots.some(
          (slot) =>
            slot.clinicianId === result.data.recommendedSlot?.clinicianId &&
            slot.date === result.data.recommendedSlot.date &&
            slot.time === result.data.recommendedSlot.time,
        );
      sendData(response, allowedSlot ? result : { data: fallback, source: "fallback" });
    }),
  );

  app.post(
    "/api/v1/ai/inventory/insights",
    requireRoles("admin", "nurse"),
    asyncRoute(async (request, response) => {
      const parsed = inventoryInsightInput.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid inventory input.");
      const fallback = inventoryFallback(parsed.data);
      const result = await generateStructuredOutput(
        [
          "You are a clinic inventory forecasting assistant.",
          "Use only supplied aggregate stock and average-use values.",
          "Recommendations are advisory and must not mutate inventory.",
          JSON.stringify(parsed.data),
        ].join("\n"),
        "inventory_insights",
        {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  medicineId: { type: "string", format: "uuid" },
                  recommendedReorderQuantity: { type: "integer", minimum: 0 },
                  risk: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["medicineId", "recommendedReorderQuantity", "risk"],
                additionalProperties: false,
              },
            },
            summary: { type: "string" },
          },
          required: ["insights", "summary"],
          additionalProperties: false,
        },
        inventoryInsightOutput,
        fallback,
      );
      const validIds = new Set(parsed.data.items.map((item) => item.medicineId));
      const valid = result.data.insights.every((insight) => validIds.has(insight.medicineId));
      sendData(response, valid ? result : { data: fallback, source: "fallback" });
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Calls OpenRouter with strict JSON Schema and validates the response again locally.
async function generateStructuredOutput<T>(
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  outputSchema: z.ZodType<T>,
  fallback: T,
): Promise<{ data: T; model?: string; source: "fallback" | "openrouter" }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) return { data: fallback, source: "fallback" };
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.OPENROUTER_TIMEOUT_MS ?? 10_000),
  );
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "x-openrouter-title": "Zentraq AI Service",
      },
      body: JSON.stringify({
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
        model,
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            schema: jsonSchema,
            strict: true,
          },
        },
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { data: fallback, source: "fallback" };
    const envelope = openRouterResponseSchema.safeParse(await response.json());
    const content = envelope.success ? envelope.data.choices[0]?.message.content : null;
    if (!envelope.success || !content) return { data: fallback, source: "fallback" };
    const parsed = outputSchema.safeParse(JSON.parse(content) as unknown);
    if (!parsed.success) return { data: fallback, source: "fallback" };
    return { data: parsed.data, model: envelope.data.model, source: "openrouter" };
  } catch {
    return { data: fallback, source: "fallback" };
  } finally {
    clearTimeout(timeout);
  }
}

// Produces a conservative deterministic appointment recommendation when AI is unavailable.
function appointmentFallback(
  input: z.infer<typeof appointmentRecommendationInput>,
): z.infer<typeof appointmentRecommendationOutput> {
  const urgentTerms = ["severe", "difficulty breathing", "chest pain", "unconscious", "bleeding"];
  const text = `${input.reason} ${input.symptoms ?? ""}`.toLowerCase();
  const priority = urgentTerms.some((term) => text.includes(term)) ? 5 : 3;
  return {
    priority,
    rationale:
      priority === 5
        ? "Potentially urgent wording requires immediate clinician review; this is not a diagnosis."
        : "Standard priority pending clinician review; this is an advisory result.",
    recommendedSlot: input.availableSlots[0] ?? null,
  };
}

// Produces a transparent fourteen-day stock recommendation when AI is unavailable.
function inventoryFallback(
  input: z.infer<typeof inventoryInsightInput>,
): z.infer<typeof inventoryInsightOutput> {
  return {
    insights: input.items.map((item) => {
      const target = Math.ceil(item.averageDailyUse * 14);
      const recommendedReorderQuantity = Math.max(0, target - item.currentStock);
      return {
        medicineId: item.medicineId,
        recommendedReorderQuantity,
        risk:
          item.currentStock <= item.averageDailyUse * 3
            ? "high" as const
            : item.currentStock <= item.averageDailyUse * 7
              ? "medium" as const
              : "low" as const,
      };
    }),
    summary: "Fallback forecast uses a transparent fourteen-day target and does not change stock.",
  };
}
