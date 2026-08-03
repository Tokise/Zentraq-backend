import "server-only"
import { headers } from "next/headers"
import { createAdminClient } from "@/utils/supabase/admin"

export type AuditAction =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILED"
  | "AUTH_LOGOUT"
  | "AUTH_PASSWORD_RESET"
  | "ROLE_CHANGE"
  | "MEDICAL_RECORD_ACCESS"
  | "MEDICAL_RECORD_MODIFY"
  | "INVENTORY_MODIFICATION"
  | "RFID_SCAN"
  | "APPOINTMENT_CHANGE"
  | "OPERATOR_CREATED"
  | "OPERATOR_REMOVED"
  | "STUDENT_ACCOUNT_CREATED"
  | "NOTIFICATION_SENT"
  | "NOTIFICATION_READ"
  | "NOTIFICATION_UNREAD"
  | "NOTIFICATION_DELETED"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "PERMISSION_ASSIGNED"
  | "PERMISSION_REMOVED"
  | "SERVICE_CREATED"
  | "SERVICE_UPDATED"
  | "SERVICE_ARCHIVED"
  | "SERVICE_RESTORED"
  | "SETTING_UPDATED"
  | "FACULTY_ACCOUNT_CREATED"
  | "FACULTY_ACCOUNT_UPDATED"
  | "FACULTY_ACCOUNT_ARCHIVED"
  | "FACULTY_PASSWORD_RESET"
  | "RFID_LOOKUP"
  | "RFID_NO_MATCH"

export interface AuditLogOptions {
  action: AuditAction
  userId?: string | null
  email?: string | null
  resource?: string
  details?: Record<string, unknown>
}

/**
 * Server-Side Audit Logger.
 * Records security-sensitive operations with client IP, User-Agent, and timestamp.
 */
export async function logAuditEvent(options: AuditLogOptions): Promise<void> {
  try {
    const headerStore = await headers()
    const rawIp = headerStore.get("x-forwarded-for") || headerStore.get("x-real-ip") || "127.0.0.1"
    const ipAddress = rawIp.split(",")[0].trim()
    const userAgent = headerStore.get("user-agent") || "Unknown Device"

    const admin = createAdminClient()

    await admin.from("audit_logs").insert({
      user_id: options.userId || null,
      action: options.action,
      entity_type: "application",
      entity_id: options.resource || null,
      metadata: { ...options.details, actor_email: options.email || null },
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  } catch (err) {
    // Audit logging failure should not crash main workflow, but must be logged to stdout
    console.error("[AuditLogger Error] Failed to persist audit log:", err)
  }
}
