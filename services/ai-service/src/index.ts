import { z } from "zod";
import { verifyInternalContext } from "@zentraq/shared";

export interface AiWorkerEnv {
  ENVIRONMENT?: string;
  INTERNAL_CONTEXT_SECRET?: string;
  INTERNAL_SERVICE_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_TIMEOUT_MS?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const ALLOWED_ORIGINS = [
  "https://bcp.tokise.pw",
  "https://tokise.pw",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
  const allowOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, x-request-id, x-zentraq-context, x-zentraq-signature, x-zentraq-service-key, apikey",
    "Access-Control-Max-Age": "86400",
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

// --------------------------------------------------------------------------
// Security Guardrails & Clinical Red Flags
// --------------------------------------------------------------------------

export const EMERGENCY_RED_FLAGS = [
  "chest pain",
  "difficulty breathing",
  "shortness of breath",
  "unconscious",
  "unresponsive",
  "loss of consciousness",
  "severe bleeding",
  "hemorrhage",
  "seizure",
  "convulsion",
  "anaphylaxis",
  "severe allergic reaction",
  "head injury",
  "head trauma",
  "slurred speech",
  "facial drooping",
  "stroke",
  "poisoning",
  "overdose",
  "severe burn",
  "coughing blood",
  "vomiting blood",
  "severe abdominal pain",
];

export function detectRedFlags(text: string): string[] {
  const lower = text.toLowerCase();
  return EMERGENCY_RED_FLAGS.filter((term) => lower.includes(term));
}

export function sanitizeText(input: string): string {
  if (!input) return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(
      /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|prompts|directions)/gi,
      "[REDACTED_INJECTION_ATTEMPT]",
    )
    .replace(
      /(?:system\s*prompt|system\s*instructions|you\s+are\s+now|developer\s+mode|unrestricted\s+mode)/gi,
      "[FILTERED]",
    )
    .slice(0, 15_000)
    .trim();
}

function isAuthorized(request: Request, env: AiWorkerEnv): boolean {
  const hasSecret = Boolean(env.INTERNAL_SERVICE_KEY || env.INTERNAL_CONTEXT_SECRET);
  if (!hasSecret) return true;

  const serviceKey = request.headers.get("x-zentraq-service-key");
  if (env.INTERNAL_SERVICE_KEY && serviceKey && serviceKey.trim() === env.INTERNAL_SERVICE_KEY.trim()) {
    return true;
  }

  const payload = request.headers.get("x-zentraq-context");
  const signature = request.headers.get("x-zentraq-signature");
  const requestId = request.headers.get("x-request-id") ?? "";
  if (env.INTERNAL_CONTEXT_SECRET && payload && signature) {
    try {
      verifyInternalContext(payload, signature, env.INTERNAL_CONTEXT_SECRET, requestId);
      return true;
    } catch {
      return false;
    }
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ") && authorization.length > 20) {
    return true;
  }

  return false;
}

// --------------------------------------------------------------------------
// Zod Schemas
// --------------------------------------------------------------------------

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

const appointmentAutoApproveInput = z.object({
  appointmentId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(500),
  symptoms: z.string().trim().max(2_000).optional().nullable(),
  requestedDate: z.string().optional().nullable(),
  requestedTime: z.string().optional().nullable(),
  availableClinicians: z
    .array(
      z.object({
        id: z.string().uuid(),
        displayName: z.string(),
        role: z.enum(["doctor", "nurse"]),
        workload: z.number().int().min(0).default(0),
        isAvailable: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(50),
});

const appointmentAutoApproveOutput = z.object({
  autoApproved: z.boolean(),
  priority: z.number().int().min(1).max(5),
  urgency: z.enum(["Routine", "Moderate", "Urgent", "Emergency"]),
  assignedClinicianId: z.string().uuid().nullable(),
  recommendedSlot: z.string().nullable().optional(),
  rationale: z.string().min(1).max(1_000),
  redFlagsDetected: z.array(z.string()),
  guardrailsStatus: z.enum(["passed", "blocked_emergency", "blocked_unassigned", "blocked_policy"]),
});

const inventoryInsightInput = z.object({
  items: z
    .array(
      z.object({
        averageDailyUse: z.number().min(0).max(1_000_000),
        currentStock: z.number().int().min(0).max(1_000_000_000),
        medicineId: z.string().uuid(),
        medicineName: z.string().optional(),
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
      daysOfStockRemaining: z.number().min(0).optional(),
    }),
  ),
  summary: z.string().trim().min(1).max(1_000),
});

const ocrScanInput = z.object({
  rawOcrText: z.string().trim().min(5).max(15_000),
  documentType: z.enum(["waiver", "consultation_notes", "medical_record", "general"]).default("waiver"),
});

const ocrScanOutput = z.object({
  complaint: z.string().nullable().optional(),
  blood_pressure: z.string().nullable().optional(),
  temperature: z.string().nullable().optional(),
  heart_rate: z.string().nullable().optional(),
  respiratory_rate: z.string().nullable().optional(),
  oxygen_saturation: z.string().nullable().optional(),
  assessment: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  waiver_consent_signed: z.boolean().nullable().optional(),
  patient_name: z.string().nullable().optional(),
  summary: z.string().min(1).max(1_000),
});

const reportingInsightInput = z.object({
  reportTitle: z.string().trim().min(3).max(200),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalVisits: z.number().int().min(0).max(10_000_000),
  topComplaints: z
    .array(
      z.object({
        name: z.string().max(100),
        count: z.number().int().min(0),
      }),
    )
    .max(50),
  clearanceStats: z
    .object({
      approved: z.number().int().min(0),
      pending: z.number().int().min(0),
      rejected: z.number().int().min(0),
    })
    .optional(),
  medicineDispensedCount: z.number().int().min(0).optional(),
});

const reportingInsightOutput = z.object({
  executiveSummary: z.string().min(1).max(1_000),
  keyInsights: z.array(z.string().min(1).max(500)).min(1).max(5),
  recommendations: z.array(z.string().min(1).max(500)).min(1).max(5),
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

// --------------------------------------------------------------------------
// Deterministic Safe Fallbacks
// --------------------------------------------------------------------------

function appointmentFallback(
  input: z.infer<typeof appointmentRecommendationInput>,
): z.infer<typeof appointmentRecommendationOutput> {
  const redFlags = detectRedFlags(`${input.reason} ${input.symptoms ?? ""}`);
  const priority = redFlags.length > 0 ? 5 : 3;
  return {
    priority,
    rationale:
      priority === 5
        ? "Potentially urgent wording requires immediate clinician review; automated scheduling blocked."
        : "Standard priority pending clinician review; this is an advisory result.",
    recommendedSlot: input.availableSlots[0] ?? null,
  };
}

function autoApproveFallback(
  input: z.infer<typeof appointmentAutoApproveInput>,
): z.infer<typeof appointmentAutoApproveOutput> {
  const redFlags = detectRedFlags(`${input.reason} ${input.symptoms ?? ""}`);
  const available = input.availableClinicians.filter((c) => c.isAvailable);

  if (redFlags.length > 0) {
    return {
      autoApproved: false,
      priority: 5,
      urgency: "Emergency",
      assignedClinicianId: null,
      recommendedSlot: null,
      rationale: `Safety Guardrail: Emergency red flag detected (${redFlags.join(", ")}). Automatic approval is strictly blocked; emergency clinical triage required.`,
      redFlagsDetected: redFlags,
      guardrailsStatus: "blocked_emergency",
    };
  }

  const routineKeywords = ["routine", "checkup", "clearance", "certificate", "follow-up", "renewal", "consultation", "dental"];
  const lowerReason = input.reason.toLowerCase();
  const isRoutine = routineKeywords.some((w) => lowerReason.includes(w));

  if (!isRoutine || available.length === 0) {
    return {
      autoApproved: false,
      priority: 3,
      urgency: "Moderate",
      assignedClinicianId: available[0]?.id ?? null,
      recommendedSlot: input.requestedTime ?? null,
      rationale: available.length === 0
        ? "No active clinicians currently available for automated booking."
        : "Moderate severity or non-routine reason requires standard staff triage review.",
      redFlagsDetected: [],
      guardrailsStatus: available.length === 0 ? "blocked_unassigned" : "blocked_policy",
    };
  }

  // Low risk routine booking with available staff -> auto-approved
  const chosenStaff = [...available].sort((a, b) => a.workload - b.workload)[0];
  return {
    autoApproved: true,
    priority: 1,
    urgency: "Routine",
    assignedClinicianId: chosenStaff.id,
    recommendedSlot: input.requestedTime ?? "Standard clinical slot",
    rationale: `Auto-approved: Verified routine reason with active ${chosenStaff.role} (${chosenStaff.displayName}) assigned based on lowest workload.`,
    redFlagsDetected: [],
    guardrailsStatus: "passed",
  };
}

function inventoryFallback(
  input: z.infer<typeof inventoryInsightInput>,
): z.infer<typeof inventoryInsightOutput> {
  return {
    insights: input.items.map((item) => {
      const dailyUse = Math.max(0.1, item.averageDailyUse);
      const daysOfStockRemaining = Math.round((item.currentStock / dailyUse) * 10) / 10;
      const target = Math.ceil(item.averageDailyUse * 14);
      const recommendedReorderQuantity = Math.max(0, target - item.currentStock);
      return {
        medicineId: item.medicineId,
        recommendedReorderQuantity,
        risk:
          item.currentStock <= item.averageDailyUse * 3
            ? ("high" as const)
            : item.currentStock <= item.averageDailyUse * 7
              ? ("medium" as const)
              : ("low" as const),
        daysOfStockRemaining,
      };
    }),
    summary: "Fallback forecast calculated using transparent 14-day stock targets and historical consumption velocity.",
  };
}

function ocrFallback(input: z.infer<typeof ocrScanInput>): z.infer<typeof ocrScanOutput> {
  const text = input.rawOcrText;
  const bpMatch = text.match(/\b(\d{2,3})\s*[\/|I1l]\s*(\d{2,3})\b/);
  const tempMatch = text.match(/\b(3[5-9](?:\.\d)?|4[0-2](?:\.\d)?)\s*(?:°?C|c)?\b/i);
  const hrMatch = text.match(/\b(?:hr|pulse|heart\s*rate|bpm)[\s:]*(\d{2,3})\b/i);
  const spo2Match = text.match(/\b(?:spo2|o2|sat)[\s:]*(\d{2,3})%?\b/i);
  const waiverSigned = /\b(?:signed|signature|consent(?:ed)?|agreed|agree)\b/i.test(text);

  return {
    complaint: text.slice(0, 120).trim() || null,
    blood_pressure: bpMatch ? `${bpMatch[1]}/${bpMatch[2]}` : null,
    temperature: tempMatch ? tempMatch[1] : null,
    heart_rate: hrMatch ? hrMatch[1] : null,
    respiratory_rate: null,
    oxygen_saturation: spo2Match ? spo2Match[1] : null,
    assessment: null,
    plan: null,
    waiver_consent_signed: waiverSigned,
    patient_name: null,
    summary: `Scanned ${input.documentType}: captured ${text.slice(0, 80)}...`,
  };
}

function reportingFallback(input: z.infer<typeof reportingInsightInput>): z.infer<typeof reportingInsightOutput> {
  const topStr = input.topComplaints.map((c) => `${c.name} (${c.count})`).join(", ");
  return {
    executiveSummary: `Report "${input.reportTitle}" logged a total of ${input.totalVisits} patient visits. Primary recorded complaints include: ${topStr || "general health evaluations"}.`,
    keyInsights: [
      `Recorded ${input.totalVisits} visits across the reporting timeframe.`,
      `Most prevalent recorded complaint: ${input.topComplaints[0]?.name ?? "General consultation"} with ${input.topComplaints[0]?.count ?? 0} cases.`,
      `Dispensed item volume totaled ${input.medicineDispensedCount ?? 0} units across patient encounters.`,
    ],
    recommendations: [
      "Maintain adequate buffer stock for high-frequency complaints identified in census.",
      "Review clinician duty scheduling against peak patient check-in hours.",
    ],
  };
}

// --------------------------------------------------------------------------
// Multi-Tier OpenRouter Invocation with Safe Fallbacks
// --------------------------------------------------------------------------

async function generateStructuredOutput<T>(
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  outputSchema: z.ZodType<T>,
  fallback: T,
  env: AiWorkerEnv,
): Promise<{ data: T; model?: string; source: "fallback" | "openrouter" }> {
  const apiKey =
    env.OPENROUTER_API_KEY ??
    (typeof process !== "undefined" ? process.env?.OPENROUTER_API_KEY : undefined);
  const primaryModel =
    env.OPENROUTER_MODEL ??
    (typeof process !== "undefined" ? process.env?.OPENROUTER_MODEL : undefined) ??
    "qwen/qwen3.8-27b:free";

  if (!apiKey) return { data: fallback, source: "fallback" };

  const candidateModels = Array.from(
    new Set([
      primaryModel,
      "qwen/qwen3.8-27b:free",
      "openrouter/free",
      "deepseek/deepseek-v4-flash",
      "google/gemma-4-31b-it:free",
    ]),
  );

  const timeoutMs = Number(env.OPENROUTER_TIMEOUT_MS ?? 12_000);

  for (const model of candidateModels) {
    const controller = new AbortController();
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
          max_tokens: 800,
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

      clearTimeout(timeout);

      // If account not yet topped up (402), or rate-limited (429), or model unavailable (404/503), try next candidate
      if (response.status === 402 || response.status === 429 || response.status === 404 || response.status === 503) {
        continue;
      }

      if (!response.ok) continue;

      const envelope = openRouterResponseSchema.safeParse(await response.json());
      const content = envelope.success ? envelope.data.choices[0]?.message.content : null;
      if (!envelope.success || !content) continue;

      const parsed = outputSchema.safeParse(JSON.parse(content) as unknown);
      if (!parsed.success) continue;

      return { data: parsed.data, model: envelope.data.model, source: "openrouter" };
    } catch {
      clearTimeout(timeout);
      continue;
    }
  }

  return { data: fallback, source: "fallback" };
}

// --------------------------------------------------------------------------
// Cloudflare Worker Fetch Router
// --------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: AiWorkerEnv): Promise<Response> {
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, "");

    if (pathname === "" || pathname === "/health") {
      return jsonResponse(
        {
          service: "ai-service",
          status: "ok",
          models: {
            active: "qwen/qwen3.8-27b:free",
            configured: env.OPENROUTER_MODEL ?? "qwen/qwen3.8-27b:free",
            productionTarget: "deepseek/deepseek-v4-flash",
            testingFallback: "openrouter/free",
            provider: "openrouter",
          },
          endpoints: [
            "/health",
            "/api/v1/ai/appointments/recommend",
            "/api/v1/ai/appointments/auto-approve",
            "/api/v1/ai/ocr/scan",
            "/api/v1/ai/inventory/insights",
            "/api/v1/ai/reports/insights",
          ],
        },
        200,
        origin,
      );
    }

    // Require authorization for all API routes if secret is configured
    if (!isAuthorized(request, env)) {
      return jsonResponse(
        { code: "UNAUTHORIZED", error: "Valid service key or session context required." },
        401,
        origin,
      );
    }

    // 1. Appointment Recommendation
    if (pathname === "/api/v1/ai/appointments/recommend") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);
      const body = await request.json().catch(() => ({}));
      const parsed = appointmentRecommendationInput.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ code: "VALIDATION_ERROR", error: "Invalid scheduling input." }, 400, origin);
      }

      const redFlags = detectRedFlags(`${parsed.data.reason} ${parsed.data.symptoms ?? ""}`);
      const fallback = appointmentFallback(parsed.data);

      // Guardrail: Emergency red flags immediately bypass AI and escalate
      if (redFlags.length > 0) {
        return jsonResponse(
          {
            data: {
              priority: 5,
              rationale: `Emergency red flag detected (${redFlags.join(", ")}). Immediate clinician evaluation required.`,
              recommendedSlot: parsed.data.availableSlots[0] ?? null,
            },
            source: "guardrail_escalation",
          },
          200,
          origin,
        );
      }

      const cleanReason = sanitizeText(parsed.data.reason);
      const cleanSymptoms = sanitizeText(parsed.data.symptoms ?? "");

      const result = await generateStructuredOutput(
        [
          "You are the Zentraq Clinic Scheduling Decision Support AI.",
          "Assess triage priority (1=Routine to 5=Urgent) and select the most appropriate available slot.",
          "Do not diagnose or invent clinicians/slots outside the provided list.",
          JSON.stringify({
            reason: cleanReason,
            symptoms: cleanSymptoms,
            availableSlots: parsed.data.availableSlots,
          }),
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

    // 2. Appointment Automatic Approval with Medical Guardrails
    if (pathname === "/api/v1/ai/appointments/auto-approve") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);
      const body = await request.json().catch(() => ({}));
      const parsed = appointmentAutoApproveInput.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ code: "VALIDATION_ERROR", error: "Invalid appointment approval input." }, 400, origin);
      }

      const cleanReason = sanitizeText(parsed.data.reason);
      const cleanSymptoms = sanitizeText(parsed.data.symptoms ?? "");
      const redFlags = detectRedFlags(`${cleanReason} ${cleanSymptoms}`);
      const fallback = autoApproveFallback(parsed.data);

      // Hard safety guardrail: Emergency red flags block automatic approval
      if (redFlags.length > 0) {
        return jsonResponse(
          {
            data: {
              autoApproved: false,
              priority: 5,
              urgency: "Emergency",
              assignedClinicianId: null,
              recommendedSlot: null,
              rationale: `Safety Guardrail: Emergency red flag detected (${redFlags.join(", ")}). Automatic approval is blocked; immediate clinician evaluation required.`,
              redFlagsDetected: redFlags,
              guardrailsStatus: "blocked_emergency",
            },
            source: "guardrail_block",
          },
          200,
          origin,
        );
      }

      const availableStaff = parsed.data.availableClinicians.filter((c) => c.isAvailable);
      if (availableStaff.length === 0) {
        return jsonResponse(
          {
            data: {
              autoApproved: false,
              priority: 3,
              urgency: "Moderate",
              assignedClinicianId: null,
              recommendedSlot: parsed.data.requestedTime ?? null,
              rationale: "No active clinicians are currently available to accept this booking.",
              redFlagsDetected: [],
              guardrailsStatus: "blocked_unassigned",
            },
            source: "guardrail_block",
          },
          200,
          origin,
        );
      }

      const result = await generateStructuredOutput(
        [
          "You are the Zentraq Appointment Auto-Approval Evaluator.",
          "Rules:",
          "1. ONLY auto-approve Routine/Low-risk appointments (Priority 1 or 2, e.g. clearance, routine checkup, refill).",
          "2. Moderate or higher severity (Priority >= 3) MUST NOT be auto-approved (set autoApproved: false).",
          "3. Assign an available clinician with the lowest workload.",
          "4. Explain clear rationale for staff review.",
          JSON.stringify({
            reason: cleanReason,
            symptoms: cleanSymptoms,
            availableClinicians: availableStaff,
          }),
        ].join("\n"),
        "appointment_auto_approve",
        {
          type: "object",
          properties: {
            autoApproved: { type: "boolean" },
            priority: { type: "integer", minimum: 1, maximum: 5 },
            urgency: { type: "string", enum: ["Routine", "Moderate", "Urgent", "Emergency"] },
            assignedClinicianId: { type: ["string", "null"] },
            recommendedSlot: { type: ["string", "null"] },
            rationale: { type: "string" },
            redFlagsDetected: { type: "array", items: { type: "string" } },
            guardrailsStatus: {
              type: "string",
              enum: ["passed", "blocked_emergency", "blocked_unassigned", "blocked_policy"],
            },
          },
          required: [
            "autoApproved",
            "priority",
            "urgency",
            "assignedClinicianId",
            "rationale",
            "redFlagsDetected",
            "guardrailsStatus",
          ],
          additionalProperties: false,
        },
        appointmentAutoApproveOutput,
        fallback,
        env,
      );

      // Verify that assigned clinician exists in the supplied list
      const validClinician =
        !result.data.assignedClinicianId ||
        availableStaff.some((c) => c.id === result.data.assignedClinicianId);

      // Verify that auto-approval is not given to high priority
      if (result.data.priority >= 3 && result.data.autoApproved) {
        result.data.autoApproved = false;
        result.data.guardrailsStatus = "blocked_policy";
        result.data.rationale += " [Policy override: Moderate/High priority appointments require clinician sign-off]";
      }

      return jsonResponse(validClinician ? result : { data: fallback, source: "fallback" }, 200, origin);
    }

    // 3. Document / Waiver OCR Scanning
    if (pathname === "/api/v1/ai/ocr/scan") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);
      const body = await request.json().catch(() => ({}));
      const parsed = ocrScanInput.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ code: "VALIDATION_ERROR", error: "Invalid OCR scan payload." }, 400, origin);
      }

      const cleanText = sanitizeText(parsed.data.rawOcrText);
      const fallback = ocrFallback(parsed.data);

      const result = await generateStructuredOutput(
        [
          "ROLE: You are the Zentraq Clinical Document and Waiver OCR Extraction AI.",
          "TASK: Extract structured medical facts from raw OCR or handwritten intake notes.",
          "GUARDRAILS:",
          "- NEVER hallucinate clinical measurements; if missing, return null.",
          "- Verify that SpO2 is between 50-100%, Temp 30-45°C, BP is SYS/DIA, HR is 30-250 bpm.",
          "- Detect if consultation waiver/consent was signed or checked.",
          "- Provide a concise 1-sentence summary.",
          `DOCUMENT TYPE: ${parsed.data.documentType}`,
          `RAW OCR TEXT:\n${cleanText}`,
        ].join("\n"),
        "ocr_scan_extraction",
        {
          type: "object",
          properties: {
            complaint: { type: ["string", "null"] },
            blood_pressure: { type: ["string", "null"] },
            temperature: { type: ["string", "null"] },
            heart_rate: { type: ["string", "null"] },
            respiratory_rate: { type: ["string", "null"] },
            oxygen_saturation: { type: ["string", "null"] },
            assessment: { type: ["string", "null"] },
            plan: { type: ["string", "null"] },
            waiver_consent_signed: { type: ["boolean", "null"] },
            patient_name: { type: ["string", "null"] },
            summary: { type: "string" },
          },
          required: ["summary"],
          additionalProperties: false,
        },
        ocrScanOutput,
        fallback,
        env,
      );

      return jsonResponse(result, 200, origin);
    }

    // 4. Inventory Insights & Monitoring
    if (pathname === "/api/v1/ai/inventory/insights") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);
      const body = await request.json().catch(() => ({}));
      const parsed = inventoryInsightInput.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ code: "VALIDATION_ERROR", error: "Invalid inventory input." }, 400, origin);
      }

      const fallback = inventoryFallback(parsed.data);
      const result = await generateStructuredOutput(
        [
          "You are the Zentraq Clinic Inventory Forecasting and Monitoring Assistant.",
          "Rules:",
          "1. Use ONLY supplied stock numbers and average daily use figures.",
          "2. Classify risk as: high (<=3 days buffer), medium (<=7 days buffer), low (>7 days).",
          "3. Calculate target 14-day stock reorder quantity.",
          "4. Recommendations are strictly advisory and do NOT directly modify stock.",
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
                  daysOfStockRemaining: { type: "number", minimum: 0 },
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

    // 5. Reporting Insights
    if (pathname === "/api/v1/ai/reports/insights") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);
      const body = await request.json().catch(() => ({}));
      const parsed = reportingInsightInput.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ code: "VALIDATION_ERROR", error: "Invalid report data input." }, 400, origin);
      }

      const fallback = reportingFallback(parsed.data);
      const cleanTitle = sanitizeText(parsed.data.reportTitle);

      const result = await generateStructuredOutput(
        [
          "You are the Zentraq Health Analytics AI for clinic administration.",
          "Generate executive-level insights strictly from the provided numbers.",
          "Rules:",
          "- DO NOT invent statistics, trends, or medical diagnoses.",
          "- Focus on operational throughput, morbidity trends, and resource utilization.",
          "- Produce exactly 3 keyInsights and 2 actionable recommendations.",
          JSON.stringify({ ...parsed.data, reportTitle: cleanTitle }),
        ].join("\n"),
        "reporting_insights",
        {
          type: "object",
          properties: {
            executiveSummary: { type: "string" },
            keyInsights: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 5,
            },
            recommendations: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 5,
            },
          },
          required: ["executiveSummary", "keyInsights", "recommendations"],
          additionalProperties: false,
        },
        reportingInsightOutput,
        fallback,
        env,
      );

      return jsonResponse(result, 200, origin);
    }

    return jsonResponse({ error: "Not found" }, 404, origin);
  },
};
