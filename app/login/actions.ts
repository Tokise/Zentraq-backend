"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { checkRateLimit } from "@/lib/rate-limit"
import { logAuditEvent } from "@/lib/audit-logger"

const COOKIE_NAME = "zentraq_session_token"
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

export async function login(formData: FormData) {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const clientIp = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1"

  const email = (formData.get("email") as string)?.trim().toLowerCase()
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  // 1. Enforce Rate Limiting (5 attempts per 15 minutes per IP + Email)
  const rateLimitResult = checkRateLimit(`login:${clientIp}:${email}`, 5, 15 * 60 * 1000)
  if (!rateLimitResult.success) {
    await logAuditEvent({
      action: "AUTH_LOGIN_FAILED",
      email,
      details: { reason: "Rate limit exceeded", resetInSeconds: rateLimitResult.resetInSeconds },
    })
    return {
      error: `Too many login attempts. Please try again in ${rateLimitResult.resetInSeconds} seconds.`,
    }
  }

  const supabase = createClient(cookieStore)
  const admin = createAdminClient()

  // 2. Perform Supabase Authentication
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    await logAuditEvent({
      action: "AUTH_LOGIN_FAILED",
      email,
      details: { error: error?.message || "Invalid credentials" },
    })
    return { error: "Invalid email or password" }
  }

  // 3. Generate Cryptographically Secure Session Token for One-Device Enforcement
  const sessionToken = randomBytes(32).toString("hex")

  // Check clinic_accounts first
  const { data: clinicAccountData } = await admin
    .from("clinic_accounts")
    .select("id, role")
    .eq("id", data.user.id)
    .maybeSingle()

  let userRole = "nurse"

  if (clinicAccountData) {
    userRole = String(clinicAccountData.role).toLowerCase()
    await admin
      .from("clinic_accounts")
      .update({ current_session_token: sessionToken })
      .eq("id", data.user.id)
  } else {
    // Check student_accounts
    const { data: studentAccountData } = await admin
      .from("student_accounts")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle()

    if (studentAccountData) {
      userRole = "student"
      await admin
        .from("student_accounts")
        .update({ current_session_token: sessionToken })
        .eq("user_id", data.user.id)
    } else {
      // Check faculty_accounts
      const { data: facultyAccountData } = await admin
        .from("faculty_accounts")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle()

      if (facultyAccountData) {
        userRole = "faculty"
        await admin
          .from("faculty_accounts")
          .update({ current_session_token: sessionToken })
          .eq("user_id", data.user.id)
      }
    }
  }

  // 4. Set Secure HttpOnly Cookie (NEVER expose to Client JS / localStorage)
  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  })

  // 5. Log Audit Event
  await logAuditEvent({
    action: "AUTH_LOGIN_SUCCESS",
    userId: data.user.id,
    email: data.user.email,
    details: { role: userRole },
  })

  // 6. Determine redirect based on user role
  let redirectTo = "/"
  if (userRole === "admin") {
    redirectTo = "/admin/rfid-registration"
  } else if (userRole === "nurse") {
    redirectTo = "/nurse"
  } else if (userRole === "doctor") {
    redirectTo = "/doctor"
  } else if (userRole === "student") {
    redirectTo = "/student"
  } else if (userRole === "faculty") {
    redirectTo = "/faculty"
  }

  revalidatePath("/", "layout")
  return { success: true, redirectTo }
}

export async function logout() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const admin = createAdminClient()

    // Clear session token from all account tables in DB
    await admin
      .from("clinic_accounts")
      .update({ current_session_token: null })
      .eq("id", user.id)

    await admin
      .from("student_accounts")
      .update({ current_session_token: null })
      .eq("user_id", user.id)

    await admin
      .from("faculty_accounts")
      .update({ current_session_token: null })
      .eq("user_id", user.id)

    await logAuditEvent({
      action: "AUTH_LOGOUT",
      userId: user.id,
      email: user.email,
    })
  }

  // Delete HttpOnly Cookie
  cookieStore.delete(COOKIE_NAME)

  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  return { success: true }
}
