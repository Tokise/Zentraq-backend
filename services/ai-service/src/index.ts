import { z } from "zod";

export interface AiWorkerEnv {
  ENVIRONMENT?: string;
  INTERNAL_CONTEXT_SECRET?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_TIMEOUT_MS?: string;
}

const ALLOWED_ORIGINS = [
  "https://bcp.tokise.pw",
  "https://tokise.pw",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-request-id, x-zentraq-context, x-zentraq-signature, x-zentraq-service-key",
  };
}

function jsonResponse(data: unknown, status = 200, origin: string | null = null): Response {
  return Response.json(data, {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

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

async function generateStructuredOutput<T>(
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  outputSchema: z.ZodType<T>,
  fallback: T,
  env: AiWorkerEnv,
): Promise<{ data: T; model?: string; source: "fallback" | "openrouter" }> {
  const apiKey = env.OPENROUTER_API_KEY ?? (typeof process !== "undefined" ? process.env?.OPENROUTER_API_KEY : undefined);
  const model = env.OPENROUTER_MODEL ?? (typeof process !== "undefined" ? process.env?.OPENROUTER_MODEL : undefined);
  if (!apiKey || !model) return { data: fallback, source: "fallback" };

  const controller = new AbortController();
  const timeoutMs = Number(env.OPENROUTER_TIMEOUT_MS ?? 10_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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

export default {
  async fetch(request: Request, env: AiWorkerEnv): Promise<Response> {
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, "");

    if (pathname === "/health") {
      return jsonResponse({ service: "ai-service", status: "ok" }, 200, origin);
    }

    if (pathname === "/api/v1/ai/appointments/recommend") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, origin);
      }
      const body = await request.json().catch(() => ({}));
      const parsed = appointmentRecommendationInput.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ code: "VALIDATION_ERROR", error: "Invalid scheduling input." }, 400, origin);
      }
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
        env,
      );
      const allowedSlot =
        !result.data.recommendedSlot ||
        parsed.data.availableSlots.some(
          (slot) =>
            slot.clinicianId === result.data.recommendedSlot?.clinicianId &&
            slot.date === result.data.recommendedSlot.date &&
            slot.time === result.data.recommendedSlot.time,
        );
      return jsonResponse(allowedSlot ? result : { data: fallback, source: "fallback" }, 200, origin);
    }

    if (pathname === "/api/v1/ai/inventory/insights") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, origin);
      }
      const body = await request.json().catch(() => ({}));
      const parsed = inventoryInsightInput.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ code: "VALIDATION_ERROR", error: "Invalid inventory input." }, 400, origin);
      }
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
        env,
      );
      const validIds = new Set(parsed.data.items.map((item) => item.medicineId));
      const valid = result.data.insights.every((insight) => validIds.has(insight.medicineId));
      return jsonResponse(valid ? result : { data: fallback, source: "fallback" }, 200, origin);
    }

    return jsonResponse({ error: "Not found" }, 404, origin);
  },
};
