"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { checkRateLimit } from "@/lib/rate-limit"
import { logAuditEvent } from "@/lib/audit-logger"
import { getUserRole } from "@/lib/auth/get-user-role"

const COOKIE_NAME = "zentraq_session_token"
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

export async function login(formData: FormData) {
  const cookieStore = await cookies()
  const requestHeaders = await headers()
  const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Email and password are required" }

  const rate = checkRateLimit(`login:${clientIp}:${email}`, 5, 15 * 60 * 1000)
  if (!rate.success) return { error: `Too many login attempts. Please try again in ${rate.resetInSeconds} seconds.` }

  const supabase = createClient(cookieStore)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    await logAuditEvent({ action: "AUTH_LOGIN_FAILED", email, details: { reason: "invalid_credentials" } })
    return { error: "Invalid email or password" }
  }

  const role = await getUserRole(data.user.id)
  if (!role) {
    await supabase.auth.signOut()
    return { error: "This account has no assigned role. Contact an administrator." }
  }

  const sessionToken = randomBytes(32).toString("hex")
  const admin = createAdminClient()
  await admin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", data.user.id).is("revoked_at", null)
  const { error: sessionError } = await admin.from("user_sessions").insert({
    user_id: data.user.id,
    session_token: sessionToken,
    ip_address: clientIp,
    user_agent: requestHeaders.get("user-agent"),
    expires_at: new Date(Date.now() + ONE_WEEK_SECONDS * 1000).toISOString(),
  })
  if (sessionError) return { error: "Unable to establish a secure session" }

  cookieStore.set(COOKIE_NAME, sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: ONE_WEEK_SECONDS })
  await logAuditEvent({ action: "AUTH_LOGIN_SUCCESS", userId: data.user.id, email: data.user.email, details: { role } })
  revalidatePath("/", "layout")
  return { success: true, redirectTo: role === "admin" ? "/admin" : `/${role}` }
}

export async function logout() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const token = cookieStore.get(COOKIE_NAME)?.value
  const { data: { user } } = await supabase.auth.getUser()
  if (token) await createAdminClient().from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("session_token", token).is("revoked_at", null)
  if (user) await logAuditEvent({ action: "AUTH_LOGOUT", userId: user.id, email: user.email })
  cookieStore.delete(COOKIE_NAME)
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  return { success: true }
}
