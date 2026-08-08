"use server"

import { revalidatePath } from "next/cache"
import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

// Resolves the schedule owner while preventing clinicians from editing peers.
async function getScheduleOwner(clinicAccountId?: string) {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) return null
  const admin = createAdminClient()
  if (actor.role === "admin") return { actor, clinicAccountId: clinicAccountId ?? null }
  const { data: account } = await admin
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", actor.id)
    .eq("is_active", true)
    .maybeSingle()
  if (!account || (clinicAccountId && account.id !== clinicAccountId)) return null
  return { actor, clinicAccountId: account.id }
}

// Returns the authenticated clinician's schedule or the administrator overview.
export async function getMyScheduleAction() {
  const owner = await getScheduleOwner()
  if (!owner) return { error: "Access denied", availability: [], blocks: [], clinicians: [] }
  const admin = createAdminClient()
  const accountId = owner.clinicAccountId
  const availabilityQuery = admin
    .from("staff_availability")
    .select("id, clinic_account_id, day_of_week, start_time, end_time, is_active, clinic_accounts(display_name, role)")
    .order("day_of_week")
    .order("start_time")
  const blocksQuery = admin
    .from("clinician_schedule_blocks")
    .select("id, clinic_account_id, blocked_date, start_time, end_time, reason, clinic_accounts(display_name, role)")
    .gte("blocked_date", new Date().toISOString().slice(0, 10))
    .order("blocked_date")
  if (accountId) {
    availabilityQuery.eq("clinic_account_id", accountId)
    blocksQuery.eq("clinic_account_id", accountId)
  }
  const [{ data: availability, error }, { data: blocks }, { data: clinicians }] = await Promise.all([
    availabilityQuery,
    blocksQuery,
    owner.actor.role === "admin"
      ? admin.from("clinic_accounts").select("id, display_name, role").eq("is_active", true).in("role", ["doctor", "nurse"]).order("display_name")
      : Promise.resolve({ data: [] }),
  ])
  return { error: error?.message ?? null, availability: availability ?? [], blocks: blocks ?? [], clinicians: clinicians ?? [] }
}

// Saves a recurring availability window for the signed-in clinician or admin target.
export async function saveAvailabilityAction(input: {
  id?: string
  clinic_account_id?: string
  day_of_week: number
  start_time: string
  end_time: string
}) {
  const owner = await getScheduleOwner(input.clinic_account_id)
  if (!owner?.clinicAccountId) return { error: "Access denied" }
  if (input.day_of_week < 0 || input.day_of_week > 6 || input.end_time <= input.start_time) return { error: "Enter a valid day and time range" }
  const admin = createAdminClient()
  const values = {
    clinic_account_id: owner.clinicAccountId,
    day_of_week: input.day_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    is_active: true,
  }
  const { error } = input.id
    ? await admin.from("staff_availability").update(values).eq("id", input.id).eq("clinic_account_id", owner.clinicAccountId)
    : await admin.from("staff_availability").insert(values)
  if (!error) revalidateSchedulePaths()
  return error ? { error: error.message } : { success: true }
}

// Creates a date-specific block for the signed-in clinician or admin target.
export async function addScheduleBlockAction(input: {
  clinic_account_id?: string
  blocked_date: string
  start_time: string
  end_time: string
  reason?: string
}) {
  const owner = await getScheduleOwner(input.clinic_account_id)
  if (!owner?.clinicAccountId) return { error: "Access denied" }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.blocked_date) || input.end_time <= input.start_time) return { error: "Enter a valid date and time range" }
  const { error } = await createAdminClient().from("clinician_schedule_blocks").insert({
    clinic_account_id: owner.clinicAccountId,
    blocked_date: input.blocked_date,
    start_time: input.start_time,
    end_time: input.end_time,
    reason: input.reason?.trim() || null,
    created_by: owner.actor.id,
  })
  if (!error) revalidateSchedulePaths()
  return error ? { error: error.message } : { success: true }
}

// Removes a schedule block only when it belongs to the authenticated clinician.
export async function deleteScheduleBlockAction(blockId: string) {
  const owner = await getScheduleOwner()
  if (!owner) return { error: "Access denied" }
  const admin = createAdminClient()
  let query = admin.from("clinician_schedule_blocks").delete().eq("id", blockId)
  if (owner.clinicAccountId) query = query.eq("clinic_account_id", owner.clinicAccountId)
  const { error } = await query
  if (!error) revalidateSchedulePaths()
  return error ? { error: error.message } : { success: true }
}

// Refreshes all schedule and booking interfaces after a schedule mutation.
function revalidateSchedulePaths() {
  revalidatePath("/admin/my-schedule")
  revalidatePath("/doctor/my-schedule")
  revalidatePath("/nurse/my-schedule")
  revalidatePath("/student/appointments/book")
  revalidatePath("/faculty/appointments/book")
  revalidatePath("/staff/appointments/book")
}
