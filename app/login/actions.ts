"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"

export async function login(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  const admin = createAdminClient()

  // Check current session token in both clinic_accounts and student_accounts
  const { data: clinicAccount } = await admin
    .from("clinic_accounts")
    .select("current_session_token")
    .eq("email", email)
    .maybeSingle()

  if (clinicAccount?.current_session_token) {
    await admin
      .from("clinic_accounts")
      .update({ current_session_token: null })
      .eq("email", email)
  }

  const { data: studentAccount } = await admin
    .from("student_accounts")
    .select("current_session_token")
    .eq("email", email)
    .maybeSingle()

  if (studentAccount?.current_session_token) {
    await admin
      .from("student_accounts")
      .update({ current_session_token: null })
      .eq("email", email)
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Determine which table this user belongs to and set session token
  const sessionToken = randomBytes(32).toString("hex")
  const { data: clinicAccountData } = await admin
    .from("clinic_accounts")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle()

  if (clinicAccountData) {
    await admin
      .from("clinic_accounts")
      .update({ current_session_token: sessionToken })
      .eq("id", data.user.id)
  } else {
    await admin
      .from("student_accounts")
      .update({ current_session_token: sessionToken })
      .eq("user_id", data.user.id)
  }

  // Determine redirect based on user role
  const { data: clinicRoleData } = await admin
    .from("clinic_accounts")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle()

  let redirectTo = "/"
  if (clinicRoleData?.role === "admin") {
    redirectTo = "/admin/rfid-registration"
  }

  revalidatePath("/", "layout")
  return { success: true, sessionToken, redirectTo }
}

export async function logout() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const admin = createAdminClient()
    // Clear session token from both tables
    await admin
      .from("clinic_accounts")
      .update({ current_session_token: null })
      .eq("id", user.id)

    await admin
      .from("student_accounts")
      .update({ current_session_token: null })
      .eq("user_id", user.id)
  }

  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  return { success: true }
}
