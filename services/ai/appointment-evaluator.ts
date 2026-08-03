import "server-only"

import { z } from "zod"
import { createAdminClient } from "@/utils/supabase/admin"

const EvaluationSchema = z.object({
  priority_score: z.number().int().min(1).max(5),
  rationale: z.string().min(1).max(1000),
  recommended_slot: z.string().max(100).nullable().optional(),
})

export type AppointmentEvaluation = z.infer<typeof EvaluationSchema>

export async function evaluateAppointmentWithAI(input: {
  actorId: string
  appointmentId: string
  reason: string
  symptoms: string | null
}): Promise<{ evaluation: AppointmentEvaluation; status: "success" | "fallback"; logId: string | null }> {
  const prompt = [
    "You are a clinic scheduling assistant. You do not diagnose or prescribe.",
    "Return JSON only with priority_score (1 routine to 5 urgent), rationale, and optional recommended_slot.",
    `Appointment reason: ${sanitize(input.reason)}`,
    `Reported symptoms: ${sanitize(input.symptoms ?? "Not provided")}`,
  ].join("\n")

  let responseText = ""
  let status: "success" | "fallback" = "success"
  let evaluation: AppointmentEvaluation

  try {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) throw new Error("AI service is not configured")
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_TIMEOUT_MS ?? 10000))
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "gemma-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: Number(process.env.AI_MAX_TOKENS ?? 512),
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`AI request failed (${response.status})`)
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    responseText = body.choices?.[0]?.message?.content ?? ""
    evaluation = EvaluationSchema.parse(JSON.parse(responseText))
  } catch {
    status = "fallback"
    responseText = "AI evaluation unavailable; human review required."
    evaluation = { priority_score: 3, rationale: "AI evaluation unavailable; human review required.", recommended_slot: null }
  }

  const admin = createAdminClient()
  const { data: log } = await admin
    .from("ai_logs")
    .insert({ user_id: input.actorId, action_type: "appointment_evaluation", entity_type: "appointment", entity_id: input.appointmentId, prompt, response: responseText, status })
    .select("id")
    .single()

  return { evaluation: { ...evaluation, recommended_slot: evaluation.recommended_slot ?? null }, status, logId: log?.id ?? null }
}

function sanitize(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000)
}
