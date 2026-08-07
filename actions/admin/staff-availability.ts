"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"

async function requireAdmin() {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, ["admin"]) ? actor : null
}

export async function getStaffAvailabilityAction() {
  const actor = await requireAdmin()
  if (!actor) return { error: "Access denied", availability: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("staff_availability")
    .select(`
      id,
      clinic_account_id,
      day_of_week,
      start_time,
      end_time,
      is_active,
      created_at,
      clinic_accounts!inner(display_name, role)
    `)
    .order("clinic_account_id", { ascending: true })
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) return { error: error.message, availability: [] }

  const availability = (data || []).map((row: any) => ({
    id: row.id,
    clinic_account_id: row.clinic_account_id,
    staff_name: row.clinic_accounts.display_name,
    role: row.clinic_accounts.role,
    day_of_week: row.day_of_week,
    start_time: row.start_time,
    end_time: row.end_time,
    is_active: row.is_active,
    created_at: row.created_at,
  }))

  return { error: null, availability }
}

export async function upsertStaffAvailability(formData: {
  id?: string
  clinic_account_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active?: boolean
}) {
  const actor = await requireAdmin()
  if (!actor) return { error: "Access denied" }

  if (!formData.clinic_account_id || formData.day_of_week === undefined || !formData.start_time || !formData.end_time) {
    return { error: "All fields are required" }
  }

  const admin = createAdminClient()

  if (formData.id) {
    const { error } = await admin
      .from("staff_availability")
      .update({
        clinic_account_id: formData.clinic_account_id,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        is_active: formData.is_active ?? true,
      })
      .eq("id", formData.id)

    if (error) return { error: error.message }
    return { success: true }
  }

  const { error } = await admin
    .from("staff_availability")
    .insert({
      clinic_account_id: formData.clinic_account_id,
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      is_active: formData.is_active ?? true,
    })

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteStaffAvailability(id: string) {
  const actor = await requireAdmin()
  if (!actor) return { error: "Access denied" }

  const admin = createAdminClient()
  const { error } = await admin
    .from("staff_availability")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getClinicStaffForAvailability() {
  const actor = await requireAdmin()
  if (!actor) return { error: "Access denied", staff: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("clinic_accounts")
    .select("id, display_name, role")
    .eq("is_active", true)
    .in("role", ["doctor", "nurse"])
    .order("display_name", { ascending: true })

  if (error) return { error: error.message, staff: [] }
  return { error: null, staff: data || [] }
}