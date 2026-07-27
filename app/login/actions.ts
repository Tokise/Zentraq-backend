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

  // Check current session token for this profile to enforce one-device-only
  const { data: profile } = await admin
    .from("profiles")
    .select("current_session_token")
    .eq("email", email)
    .maybeSingle()

  if (profile?.current_session_token) {
    // There's an active session — invalidate it by clearing the token
    await admin
      .from("profiles")
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

  // Set new session token for one-device-only tracking
  const sessionToken = randomBytes(32).toString("hex")
  await admin
    .from("profiles")
    .update({ current_session_token: sessionToken })
    .eq("id", data.user.id)

  revalidatePath("/", "layout")
  return { success: true, sessionToken }
}

export async function logout() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Clear session token on logout
    const admin = createAdminClient()
    await admin
      .from("profiles")
      .update({ current_session_token: null })
      .eq("id", user.id)
  }

  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  return { success: true }
}
