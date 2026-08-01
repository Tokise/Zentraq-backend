"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { revalidatePath } from "next/cache"
import { logAuditEvent } from "@/lib/audit-logger"

async function requireClinicStaff() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated", user: null }
    const role = await getUserRole(user.id)
    if (!["admin", "doctor", "nurse"].includes(role)) return { error: "Access Denied", user: null }
    return { error: null, user }
}

export interface KioskStudentDTO {
    id: string
    firstName: string
    lastName: string
    studentNumber: string | null
    employeeNumber: string | null
    department: string | null
    clinicPhotoUrl: string | null
}

/**
 * Server Action: Look up a student profile by RFID UID for the kiosk.
 * Uses Service Role via createAdminClient() — NEVER exposes full student records.
 * Requires clinic staff authentication.
 */
export async function getKioskStudentProfile(rfidUid: string) {
    try {
        // 1. Validate input length/shape before any DB query (defense in depth)
        if (!rfidUid || rfidUid.trim().length < 4 || rfidUid.trim().length > 64) {
            return { error: "Invalid RFID UID format", profile: null }
        }

        // 2. Require a valid authenticated session (kiosk is behind proxy.ts auth)
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, profile: null }
        }

        // 3. Authorized admin client lookup with MINIMUM fields the kiosk UI needs
        const admin = createAdminClient()
        const { data, error } = await admin
            .from("student_accounts")
            .select("id, first_name, last_name, student_number, employee_number, department, clinic_photo_url")
            .eq("rfid_uid", rfidUid.trim())
            .maybeSingle()

        if (error) {
            console.error("[getKioskStudentProfile DB Error]:", error)
            return { error: error.message, profile: null }
        }

        if (!data) {
            // Not found is NOT an error — the kiosk shows the UNREGISTERED state
            return { error: null, profile: null }
        }

        // 4. Return ONLY the fields the kiosk UI renders (data minimization)
        const profile: KioskStudentDTO = {
            id: data.id,
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            studentNumber: data.student_number || null,
            employeeNumber: data.employee_number || null,
            department: data.department || null,
            clinicPhotoUrl: data.clinic_photo_url || null,
        }

        return { error: null, profile }
    } catch (err: any) {
        console.error("[getKioskStudentProfile Exception]:", err)
        return { error: err?.message || "Failed to look up student", profile: null }
    }
}

export async function createConsultation(profileId: string, patientName: string, complaint: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { data, error } = await admin.from("consultations").insert({
            profile_id: profileId,
            patient_name: patientName,
            student_complaint: complaint,
            status: "waiting",
        }).select().single()
        if (error) return { error: error.message }
        await logAuditEvent({ action: "RFID_SCAN", userId: auth.user.id, email: auth.user.email, resource: data?.id, details: { patientName, complaint } })
        revalidatePath("/consultations")
        return { success: true, data }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}