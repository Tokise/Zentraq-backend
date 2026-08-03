// Permission code definitions per SAD §4 permission matrices

export const PERMISSIONS = {
    // Appointments
    APPOINTMENT_VIEW: "appointment.view",
    APPOINTMENT_CREATE: "appointment.create",
    APPOINTMENT_APPROVE: "appointment.approve",
    APPOINTMENT_REJECT: "appointment.reject",

    // Medical Records
    RECORD_VIEW: "record.view",
    RECORD_UPDATE: "record.update",
    RECORD_CREATE: "record.create",

    // Consultations
    CONSULTATION_VIEW: "consultation.view",
    CONSULTATION_CREATE: "consultation.create",
    CONSULTATION_UPDATE: "consultation.update",

    // Medicine Inventory
    INVENTORY_VIEW: "inventory.view",
    INVENTORY_MANAGE: "inventory.manage",
    DISPENSE_MEDICINE: "inventory.dispense",

    // Prescriptions
    PRESCRIPTION_WRITE: "prescription.write",
    PRESCRIPTION_VIEW: "prescription.view",

    // Incidents
    INCIDENT_VIEW: "incident.view",
    INCIDENT_MANAGE: "incident.manage",

    // Health Clearances
    CLEARANCE_VIEW: "clearance.view",
    CLEARANCE_PROCESS: "clearance.process",
    CLEARANCE_APPROVE: "clearance.approve",

    // Reports
    REPORT_VIEW: "report.view",
    REPORT_GENERATE: "report.generate",

    // User Management
    USER_MANAGE: "user.manage",
    ROLE_ASSIGN: "role.assign",

    // System
    SYSTEM_CONFIG: "system.config",
    AUDIT_VIEW: "audit.view",

    // RFID
    RFID_REGISTER: "rfid.register",
    RFID_CHECKIN: "rfid.checkin",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Role-based permission map per SAD §4.7 Global Permission Matrix
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    admin: [
        PERMISSIONS.APPOINTMENT_VIEW,
        PERMISSIONS.APPOINTMENT_CREATE,
        PERMISSIONS.APPOINTMENT_APPROVE,
        PERMISSIONS.APPOINTMENT_REJECT,
        PERMISSIONS.RECORD_VIEW,
        PERMISSIONS.CONSULTATION_VIEW,
        PERMISSIONS.INVENTORY_VIEW,
        PERMISSIONS.INVENTORY_MANAGE,
        PERMISSIONS.PRESCRIPTION_VIEW,
        PERMISSIONS.INCIDENT_VIEW,
        PERMISSIONS.INCIDENT_MANAGE,
        PERMISSIONS.CLEARANCE_VIEW,
        PERMISSIONS.CLEARANCE_PROCESS,
        PERMISSIONS.CLEARANCE_APPROVE,
        PERMISSIONS.REPORT_VIEW,
        PERMISSIONS.REPORT_GENERATE,
        PERMISSIONS.USER_MANAGE,
        PERMISSIONS.ROLE_ASSIGN,
        PERMISSIONS.SYSTEM_CONFIG,
        PERMISSIONS.AUDIT_VIEW,
        PERMISSIONS.RFID_REGISTER,
        PERMISSIONS.RFID_CHECKIN,
    ],
    doctor: [
        PERMISSIONS.APPOINTMENT_VIEW,
        PERMISSIONS.RECORD_VIEW,
        PERMISSIONS.RECORD_UPDATE,
        PERMISSIONS.CONSULTATION_VIEW,
        PERMISSIONS.CONSULTATION_CREATE,
        PERMISSIONS.CONSULTATION_UPDATE,
        PERMISSIONS.INVENTORY_VIEW,
        PERMISSIONS.PRESCRIPTION_VIEW,
        PERMISSIONS.PRESCRIPTION_WRITE,
        PERMISSIONS.INCIDENT_VIEW,
        PERMISSIONS.INCIDENT_MANAGE,
        PERMISSIONS.CLEARANCE_VIEW,
        PERMISSIONS.REPORT_VIEW,
        PERMISSIONS.RFID_CHECKIN,
    ],
    nurse: [
        PERMISSIONS.APPOINTMENT_VIEW,
        PERMISSIONS.APPOINTMENT_CREATE,
        PERMISSIONS.APPOINTMENT_APPROVE,
        PERMISSIONS.APPOINTMENT_REJECT,
        PERMISSIONS.RECORD_VIEW,
        PERMISSIONS.RECORD_UPDATE,
        PERMISSIONS.CONSULTATION_VIEW,
        PERMISSIONS.CONSULTATION_CREATE,
        PERMISSIONS.CONSULTATION_UPDATE,
        PERMISSIONS.INVENTORY_VIEW,
        PERMISSIONS.DISPENSE_MEDICINE,
        PERMISSIONS.PRESCRIPTION_VIEW,
        PERMISSIONS.INCIDENT_VIEW,
        PERMISSIONS.INCIDENT_MANAGE,
        PERMISSIONS.CLEARANCE_VIEW,
        PERMISSIONS.CLEARANCE_PROCESS,
        PERMISSIONS.REPORT_VIEW,
        PERMISSIONS.RFID_CHECKIN,
    ],
    student: [
        PERMISSIONS.APPOINTMENT_VIEW,
        PERMISSIONS.APPOINTMENT_CREATE,
        PERMISSIONS.RECORD_VIEW,
        PERMISSIONS.CONSULTATION_VIEW,
        PERMISSIONS.PRESCRIPTION_VIEW,
        PERMISSIONS.CLEARANCE_VIEW,
        PERMISSIONS.RFID_CHECKIN,
    ],
    faculty: [
        PERMISSIONS.APPOINTMENT_VIEW,
        PERMISSIONS.APPOINTMENT_CREATE,
        PERMISSIONS.RECORD_VIEW,
        PERMISSIONS.CONSULTATION_VIEW,
        PERMISSIONS.PRESCRIPTION_VIEW,
        PERMISSIONS.CLEARANCE_VIEW,
        PERMISSIONS.RFID_CHECKIN,
    ],
}

export function can(role: string | null | undefined, permission: Permission): boolean {
    if (!role) return false
    const permissions = ROLE_PERMISSIONS[role]
    if (!permissions) return false
    return permissions.includes(permission)
}