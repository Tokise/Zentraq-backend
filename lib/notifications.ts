import type { UserRole } from "@/lib/auth/roles"

export type NotificationType = "appointment" | "consultation" | "emergency" | "visit_log" | "system" | "rfid"

export type NotificationItem = {
    id: string
    type: NotificationType
    title: string
    message: string
    time: string
    read: boolean
    link?: string
    role?: UserRole
    userId?: string
}

const STORAGE_KEY_PREFIX = "zentraq_notifications_"

function getStorageKey(role: UserRole = "nurse", userId?: string): string {
    if (role === "student" && userId) {
        return `${STORAGE_KEY_PREFIX}student_${userId}`
    }
    return `${STORAGE_KEY_PREFIX}${role}`
}

/**
 * Returns default initial notifications tailored strictly per role
 */
export function getInitialNotificationsForRole(role: UserRole = "nurse", userId?: string): NotificationItem[] {
    const now = new Date()
    const formatTime = (minutesAgo: number) => {
        const d = new Date(now.getTime() - minutesAgo * 60000)
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    }

    if (role === "student") {
        return [
            {
                id: "notif-stud-1",
                type: "appointment",
                title: "Appointment Reminder",
                message: "Your upcoming health checkup is scheduled for tomorrow.",
                time: formatTime(30),
                read: false,
                link: "/student/appointments",
                role: "student",
            },
            {
                id: "notif-stud-2",
                type: "system",
                title: "Clinic Announcement",
                message: "Annual physical examination schedule has been updated.",
                time: formatTime(120),
                read: true,
                link: "/student/announcements",
                role: "student",
            },
        ]
    }

    if (role === "admin") {
        return [
            {
                id: "notif-admin-1",
                type: "rfid",
                title: "RFID Registration Activity",
                message: "New student account registered with RFID card.",
                time: formatTime(15),
                read: false,
                link: "/admin/rfid-registration",
                role: "admin",
            },
            {
                id: "notif-admin-2",
                type: "system",
                title: "System Audit Log",
                message: "Clinic announcement published by Admin.",
                time: formatTime(90),
                read: true,
                link: "/admin/clinic-announcements",
                role: "admin",
            },
        ]
    }

    // Nurse / Doctor staff notifications
    return [
        {
            id: "notif-staff-1",
            type: "consultation",
            title: "New Patient Waiting",
            message: "Student checked in at the clinic reception.",
            time: formatTime(5),
            read: false,
            link: "/consultations",
            role: role,
        },
        {
            id: "notif-staff-2",
            type: "appointment",
            title: "New Appointment Booking",
            message: "A new appointment has been scheduled for today.",
            time: formatTime(45),
            read: false,
            link: "/appointments/calendar",
            role: role,
        },
    ]
}

/**
 * Loads stored notifications from localStorage, or populates defaults if empty
 */
export function getStoredNotifications(role: UserRole = "nurse", userId?: string): NotificationItem[] {
    if (typeof window === "undefined") {
        return getInitialNotificationsForRole(role, userId)
    }

    try {
        const key = getStorageKey(role, userId)
        const raw = localStorage.getItem(key)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed
            }
        }
    } catch (e) {
        console.error("Error reading notifications from localStorage:", e)
    }

    // If no notifications stored yet, save initial ones and return
    const initial = getInitialNotificationsForRole(role, userId)
    saveNotifications(role, initial, userId)
    return initial
}

/**
 * Saves notification list to localStorage
 */
export function saveNotifications(role: UserRole = "nurse", items: NotificationItem[], userId?: string) {
    if (typeof window === "undefined") return
    try {
        const key = getStorageKey(role, userId)
        localStorage.setItem(key, JSON.stringify(items.slice(0, 50)))
    } catch (e) {
        console.error("Error saving notifications to localStorage:", e)
    }
}

/**
 * Helper to push a new notification into store
 */
export function addNotificationToStore(
    role: UserRole = "nurse",
    notif: Omit<NotificationItem, "id" | "time" | "read">,
    userId?: string
): NotificationItem {
    const newNotif: NotificationItem = {
        ...notif,
        id: `${notif.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        read: false,
        role,
        userId,
    }

    const current = getStoredNotifications(role, userId)
    const updated = [newNotif, ...current].slice(0, 50)
    saveNotifications(role, updated, userId)
    return newNotif
}
