"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"

export interface StudentProfileDTO {
  firstName: string
  lastName: string
  studentNumber: string | null
  employeeNumber: string | null
  department: string | null
  course: string | null
  yearLevel: string | null
  clinicPhotoUrl: string | null
  email: string | null
}

async function requireStudentUser() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", user: null }
  }

  const role = await getUserRole(user.id)
  if (role !== "student") {
    return { error: "Access Denied: Student portal only", user: null }
  }

  return { error: null, user }
}

export async function getStudentProfileDTO() {
  try {
    const auth = await requireStudentUser()
    if (auth.error || !auth.user) {
      return { error: auth.error, profile: null }
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("student_accounts")
      .select("first_name, last_name, student_number, employee_number, department, course, year_level, clinic_photo_url, email")
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (error) {
      console.error("[getStudentProfileDTO DB Error]:", error)
      return { error: error.message, profile: null }
    }

    if (!data) {
      return { error: "Student profile record not found", profile: null }
    }

    const profile: StudentProfileDTO = {
      firstName: data.first_name || "",
      lastName: data.last_name || "",
      studentNumber: data.student_number || null,
      employeeNumber: data.employee_number || null,
      department: data.department || null,
      course: data.course || null,
      yearLevel: data.year_level || null,
      clinicPhotoUrl: data.clinic_photo_url || null,
      email: data.email || auth.user.email || null,
    }

    return { error: null, profile }
  } catch (err: any) {
    console.error("[getStudentProfileDTO Exception]:", err)
    return { error: err?.message || "Failed to load student profile", profile: null }
  }
}

export interface StudentAnnouncementDTO {
  id: string
  title: string
  content: string
  imageUrl: string | null
  createdAt: string
  posterName: string | null
}

export async function getStudentAnnouncementsAction(limit?: number) {
  try {
    const auth = await requireStudentUser()
    if (auth.error || !auth.user) {
      return { error: auth.error, announcements: [] }
    }

    const admin = createAdminClient()
    let query = admin
      .from("announcements")
      .select("id, title, content, image_url, posted_by, created_at")
      .order("created_at", { ascending: false })

    if (limit && limit > 0) {
      query = query.limit(limit)
    }

    const { data: rawAnnouncements, error } = await query
    if (error || !rawAnnouncements) {
      return { error: error?.message || "Failed to load announcements", announcements: [] }
    }

    const posterIds = [...new Set(rawAnnouncements.map((a) => a.posted_by).filter(Boolean))]
    let posterMap: Record<string, string> = {}

    if (posterIds.length > 0) {
      const { data: posters } = await admin
        .from("clinic_accounts")
        .select("id, full_name")
        .in("id", posterIds)

      if (posters) {
        posterMap = Object.fromEntries(posters.map((p) => [p.id, p.full_name || "Clinic Staff"]))
      }
    }

    const announcements: StudentAnnouncementDTO[] = rawAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      imageUrl: a.image_url || null,
      createdAt: a.created_at,
      posterName: a.posted_by ? posterMap[a.posted_by] || null : null,
    }))

    return { error: null, announcements }
  } catch (err: any) {
    console.error("[getStudentAnnouncementsAction Exception]:", err)
    return { error: err?.message || "Failed to fetch announcements", announcements: [] }
  }
}
