"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"
import { logAuditEvent } from "@/lib/audit-logger"

async function requireClinicStaff() {
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

    if (!["admin", "doctor", "nurse"].includes(role)) {
        return {
            error: "Access Denied: Only clinic staff can manage consultations",
            user: null,
        }
    }

    return { error: null, user }
}

export async function updateConsultationStatus(id: string, status: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error }
        }

        const admin = createAdminClient()

        const updates: Record<string, any> = { status }
        if (status === "in_consultation") {
            updates.handled_at = new Date().toISOString()
        }

        const { error } = await admin
            .from("consultations")
            .update(updates)
            .eq("id", id)

        if (error) {
            return { error: error.message }
        }

        await logAuditEvent({
            action: "APPOINTMENT_CHANGE",
            userId: auth.user.id,
            email: auth.user.email,
            resource: id,
            details: { action: "STATUS_UPDATE", newStatus: status },
        })

        revalidatePath("/consultations")
        return { success: true }
    } catch (err: any) {
        console.error("[updateConsultationStatus Exception]:", err)
        return { error: err?.message || "Server error occurred" }
    }
}

export async function escalateToEmergency(id: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("consultations")
            .update({ status: "in_emergency", origin: "emergency" })
            .eq("id", id)

        if (error) {
            return { error: error.message }
        }

        await logAuditEvent({
            action: "APPOINTMENT_CHANGE",
            userId: auth.user.id,
            email: auth.user.email,
            resource: id,
            details: { action: "ESCALATED_TO_EMERGENCY" },
        })

        revalidatePath("/consultations")
        return { success: true }
    } catch (err: any) {
        console.error("[escalateToEmergency Exception]:", err)
        return { error: err?.message || "Server error occurred" }
    }
}

export async function completeConsultation(
    id: string,
    complaint: string,
    notesJson: string,
    disposition: string,
    patientName: string
) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error }
        }

        const admin = createAdminClient()
        const now = new Date().toISOString()

        // Update consultation
        const { error: consultError } = await admin
            .from("consultations")
            .update({
                status: "completed",
                student_complaint: complaint,
                handled_at: now,
                notes: notesJson,
            })
            .eq("id", id)

        if (consultError) {
            return { error: consultError.message }
        }

        // Insert visit log
        const report = JSON.parse(notesJson)
        const { error: visitError } = await admin
            .from("visit_logs")
            .insert({
                consultation_id: id,
                patient_name: patientName,
                student_complaint: complaint,
                origin: "consultation",
                diagnosis: report.diagnosis,
                treatment: report.treatment,
                recommendations: report.recommendations,
                handled_at: now,
                status: disposition,
            })

        if (visitError) {
            return { error: visitError.message }
        }

        await logAuditEvent({
            action: "MEDICAL_RECORD_MODIFY",
            userId: auth.user.id,
            email: auth.user.email,
            resource: id,
            details: { action: "CONSULTATION_COMPLETED", disposition },
        })

        revalidatePath("/consultations")
        return { success: true }
    } catch (err: any) {
        console.error("[completeConsultation Exception]:", err)
        return { error: err?.message || "Server error occurred" }
    }
}

export async function addComplaintType(name: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("complaints")
            .insert({ name })

        if (error) {
            return { error: error.message }
        }

        revalidatePath("/consultations")
        return { success: true }
    } catch (err: any) {
        console.error("[addComplaintType Exception]:", err)
        return { error: err?.message || "Server error occurred" }
    }
}

export interface ConsultationDTO {
    id: string
    patient_name: string
    student_complaint: string
    status: string
    created_at: string
    handled_at: string | null
    notes: string | null
}

/**
 * Server Action: Fetch active consultations for the clinic staff queue.
 * Uses Service Role via createAdminClient() with explicit field selection.
 * Requires clinic staff authentication.
 */
export async function getConsultationsAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, consultations: [] }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("consultations")
            .select("id, patient_name, student_complaint, status, created_at, handled_at, notes")
            .order("created_at", { ascending: false })
            .limit(50)

        if (error) {
            console.error("[getConsultationsAction DB Error]:", error)
            return { error: error.message, consultations: [] }
        }

        return { error: null, consultations: (data || []) as ConsultationDTO[] }
    } catch (err: any) {
        console.error("[getConsultationsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch consultations", consultations: [] }
    }
}

/**
 * Server Action: Fetch complaint types for the consultation wizard.
 * Requires clinic staff authentication.
 */
export async function getComplaintsAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, complaints: [] }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("complaints")
            .select("name")
            .order("created_at", { ascending: false })

        if (error) {
            console.error("[getComplaintsAction DB Error]:", error)
            return { error: error.message, complaints: [] }
        }

        const complaints: string[] = (data || []).map((c: { name: string }) => c.name)
        return { error: null, complaints }
    } catch (err: any) {
        console.error("[getComplaintsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch complaints", complaints: [] }
    }
}
