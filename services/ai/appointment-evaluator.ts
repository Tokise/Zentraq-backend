import "server-only"

import { z } from "zod"
import { createAdminClient } from "@/utils/supabase/admin"

const EvaluationSchema = z.object({
  priority_score: z.number().int().min(1).max(5),
  rationale: z.string().min(1).max(1000),
  recommended_slot: z.string().max(100).nullable().optional(),
  recommended_staff_id: z.string().uuid().nullable().optional(),
})

export type AppointmentEvaluation = z.infer<typeof EvaluationSchema>

interface StaffAvailabilityRow {
  id: string
  user_id: string
  role: string
  display_name: string
  day_of_week: number | null
  start_time: string | null
  end_time: string | null
  workload: number
}

export async function evaluateAppointmentWithAI(input: {
  actorId: string
  appointmentId: string
  reason: string
  symptoms: string | null
  scheduledDate?: string | null
  scheduledTime?: string | null
}): Promise<{ evaluation: AppointmentEvaluation; status: "success" | "fallback"; logId: string | null }> {
  // Gather staff availability data to include in the AI context
  const staffAvailability = await getStaffAvailability()

  const requestedDate = input.scheduledDate ?? null
  const requestedTime = input.scheduledTime ?? null

  const staffContext = staffAvailability.length > 0
    ? staffAvailability.map(s =>
        `- ${s.display_name} (${s.role})${s.day_of_week !== null ? ` | Day ${s.day_of_week} | ${s.start_time ?? "?"}-${s.end_time ?? "?"}` : " | No availability set"} | Workload: ${s.workload} active appointments`
      ).join("\n")
    : "No staff availability data found."

  const prompt = [
    "You are a clinic scheduling assistant. You do not diagnose or prescribe.",
    "Return JSON only with priority_score (1 routine to 5 urgent), rationale, optional recommended_slot, and optional recommended_staff_id (a UUID from the available staff list).",
    `Appointment reason: ${sanitize(input.reason)}`,
    `Reported symptoms: ${sanitize(input.symptoms ?? "Not provided")}`,
    requestedDate ? `Requested date: ${requestedDate}` : "Requested date: Flexible (not specified)",
    requestedTime ? `Requested time: ${requestedTime}` : "Requested time: Flexible (not specified)",
    "",
    "Available clinic staff (format: name (role) | Day day_of_week | start-end | workload):",
    staffContext,
    "",
    "Instructions:",
    "1. Choose the staff member whose availability (day/time) matches the requested appointment date/time, or has the lowest workload if no time is specified.",
    "2. If the requested time falls outside all staff availability, recommend the closest available slot or another day.",
    "3. Use recommended_staff_id to identify the best staff member to assign.",
    "4. Set recommended_slot to the suggested appointment time slot.",
  ].join("\n")

  let responseText = ""
  let status: "success" | "fallback" = "success"
  let evaluation: AppointmentEvaluation

  try {
    const key = process.env.AI_PROVIDER
    if (!key) throw new Error("AI service is not configured")
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_TIMEOUT_MS ?? 10000))
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "google/gemma-4-31b-it:free",
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
    evaluation = { priority_score: 3, rationale: "AI evaluation unavailable; human review required.", recommended_slot: null, recommended_staff_id: null }
  }

  const admin = createAdminClient()
  const { data: log } = await admin
    .from("ai_logs")
    .insert({ user_id: input.actorId, action_type: "appointment_evaluation", entity_type: "appointment", entity_id: input.appointmentId, prompt, response: responseText, status })
    .select("id")
    .single()

  return {
    evaluation: {
      ...evaluation,
      recommended_slot: evaluation.recommended_slot ?? null,
      recommended_staff_id: evaluation.recommended_staff_id ?? null,
    },
    status,
    logId: log?.id ?? null,
  }
}

// Fetches active clinic staff (doctors/nurses) with their availability schedules and workload
async function getStaffAvailability(): Promise<StaffAvailabilityRow[]> {
  const admin = createAdminClient()

  // Fetch active clinic accounts (doctors and nurses)
  const { data: accounts } = await admin
    .from("clinic_accounts")
    .select("id, user_id, role, display_name")
    .eq("is_active", true)
    .in("role", ["doctor", "nurse"])

  if (!accounts || accounts.length === 0) return []

  const accountIds = accounts.map((a) => a.id)

  // Try to fetch availability from the staff_availability table
  const { data: availability } = await admin
    .from("staff_availability")
    .select("clinic_account_id, day_of_week, start_time, end_time")
    .in("clinic_account_id", accountIds)
    .eq("is_active", true)

  const availabilityMap = new Map<string, { day_of_week: number | null; start_time: string | null; end_time: string | null }>()
  if (availability) {
    // Take the first availability entry for each account (simplified)
    for (const entry of availability) {
      if (!availabilityMap.has(entry.clinic_account_id)) {
        availabilityMap.set(entry.clinic_account_id, {
          day_of_week: entry.day_of_week,
          start_time: entry.start_time,
          end_time: entry.end_time,
        })
      }
    }
  }

  // Calculate active appointment workload per doctor
  const { data: activeApts } = await admin
    .from("appointments")
    .select("doctor_id")
    .in("status", ["pending", "ai_evaluated", "recommended", "approved", "scheduled", "reminded", "checked_in", "in_consultation"])
    .not("doctor_id", "is", null)

  const workloadMap: Record<string, number> = {}
  accounts.forEach((a) => { workloadMap[a.id] = 0 })
  if (activeApts) {
    activeApts.forEach((apt) => {
      if (apt.doctor_id && apt.doctor_id in workloadMap) {
        workloadMap[apt.doctor_id]++
      }
    })
  }

  return accounts.map((account) => {
    const avail = availabilityMap.get(account.id)
    return {
      id: account.id,
      user_id: account.user_id,
      role: account.role,
      display_name: account.display_name,
      day_of_week: avail?.day_of_week ?? null,
      start_time: avail?.start_time ?? null,
      end_time: avail?.end_time ?? null,
      workload: workloadMap[account.id] ?? 0,
    }
  })
}

function sanitize(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000)
}