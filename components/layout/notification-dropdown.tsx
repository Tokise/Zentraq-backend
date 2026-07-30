"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Bell, Loader2, X, Check, CalendarDays, Stethoscope, HeartPulse, ClipboardList, ShieldCheck, Megaphone } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/auth/roles"
import {
    getStoredNotifications,
    saveNotifications,
    addNotificationToStore,
    type NotificationItem,
    type NotificationType,
} from "@/lib/notifications"

const NOTIFICATION_ICONS: Record<NotificationType, any> = {
    appointment: CalendarDays,
    consultation: Stethoscope,
    emergency: HeartPulse,
    visit_log: ClipboardList,
    system: Megaphone,
    rfid: ShieldCheck,
}

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
    appointment: "text-blue-500 bg-blue-50",
    consultation: "text-emerald-500 bg-emerald-50",
    emergency: "text-red-500 bg-red-50",
    visit_log: "text-purple-500 bg-purple-50",
    system: "text-indigo-500 bg-indigo-50",
    rfid: "text-amber-500 bg-amber-50",
}

type NotificationDropdownProps = {
    userRole?: UserRole
}

export function NotificationDropdown({ userRole = "nurse" }: NotificationDropdownProps) {
    const supabase = createClient()
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [loading, setLoading] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)
    const [open, setOpen] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined)

    const isAdmin = userRole === "admin"
    const isStaff = userRole === "nurse" || userRole === "doctor"
    const isStudentUser = userRole === "student"

    // Load initial stored notifications
    useEffect(() => {
        async function init() {
            let uid: string | undefined = undefined
            if (isStudentUser) {
                const { data: { user } } = await supabase.auth.getUser()
                uid = user?.id
                setCurrentUserId(uid)
            }

            const stored = getStoredNotifications(userRole, uid)
            setNotifications(stored)
            setUnreadCount(stored.filter((n) => !n.read).length)
            setLoading(false)
        }
        init()
    }, [userRole, isStudentUser, supabase])

    const pushNewNotification = useCallback(
        (type: NotificationType, title: string, message: string, link?: string) => {
            const added = addNotificationToStore(
                userRole,
                { type, title, message, link },
                currentUserId
            )
            setNotifications((prev) => {
                const updated = [added, ...prev.filter((n) => n.id !== added.id)].slice(0, 50)
                setUnreadCount(updated.filter((n) => !n.read).length)
                return updated
            })
        },
        [userRole, currentUserId]
    )

    useEffect(() => {
        const channel = supabase.channel(`notifications-${userRole}`)

        async function setupRealtime() {
            let uid = currentUserId
            if (isStudentUser && !uid) {
                const { data: { user } } = await supabase.auth.getUser()
                uid = user?.id
                if (uid) setCurrentUserId(uid)
            }

            // Staff (nurse/doctor) notifications: clinical items
            if (isStaff) {
                channel
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "student_appointments" },
                        (payload: any) => {
                            const apt = payload.new
                            pushNewNotification(
                                "appointment",
                                "New Appointment Booking",
                                `A student booked an appointment on ${apt.appointment_date} at ${apt.time_slot}`,
                                `/appointments/calendar?id=${apt.id}&date=${apt.appointment_date}`
                            )
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "consultations" },
                        (payload: any) => {
                            const c = payload.new
                            if (c.origin === "emergency") {
                                pushNewNotification(
                                    "emergency",
                                    "🚨 Emergency Case",
                                    `${c.patient_name} — ${c.student_complaint || "Emergency"}`,
                                    `/consultations?id=${c.id}`
                                )
                            } else {
                                pushNewNotification(
                                    "consultation",
                                    "New Patient Waiting",
                                    `${c.patient_name} is waiting in queue`,
                                    `/consultations?id=${c.id}`
                                )
                            }
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "visit_logs" },
                        (payload: any) => {
                            const v = payload.new
                            pushNewNotification(
                                "visit_log",
                                "Visit Logged",
                                `${v.patient_name} — ${v.student_complaint || "Check-up"}`,
                                `/consultations/visit-logs?id=${v.id}`
                            )
                        }
                    )
            }

            // Admin notifications: administrative / system items
            if (isAdmin) {
                channel
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "announcements" },
                        (payload: any) => {
                            const a = payload.new
                            pushNewNotification(
                                "system",
                                "Announcement Published",
                                `New announcement posted: "${a.title}"`,
                                `/admin/clinic-announcements?id=${a.id}`
                            )
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "student_accounts" },
                        (payload: any) => {
                            const sa = payload.new
                            pushNewNotification(
                                "rfid",
                                "Student Account Created",
                                `${sa.first_name} ${sa.last_name} profile added`,
                                `/admin/rfid-registration?id=${sa.id}`
                            )
                        }
                    )
            }

            // Student notifications: personal appointments / announcements
            if (isStudentUser && uid) {
                channel
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "student_appointments", filter: `student_user_id=eq.${uid}` },
                        (payload: any) => {
                            const apt = payload.new
                            pushNewNotification(
                                "appointment",
                                "Appointment Booked",
                                `Your appointment on ${apt.appointment_date} at ${apt.time_slot} is pending`,
                                `/student/appointments?id=${apt.id}&date=${apt.appointment_date}`
                            )
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "UPDATE", schema: "public", table: "student_appointments", filter: `student_user_id=eq.${uid}` },
                        (payload: any) => {
                            const apt = payload.new
                            pushNewNotification(
                                "appointment",
                                "Appointment Status",
                                `Your appointment on ${apt.appointment_date} is now "${apt.status}"`,
                                `/student/appointments?id=${apt.id}&date=${apt.appointment_date}`
                            )
                        }
                    )
            }

            channel.subscribe()
        }

        setupRealtime()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, userRole, isStaff, isAdmin, isStudentUser, currentUserId, pushNewNotification])

    const markAllRead = () => {
        setNotifications((prev) => {
            const updated = prev.map((n) => ({ ...n, read: true }))
            saveNotifications(userRole, updated, currentUserId)
            return updated
        })
        setUnreadCount(0)
    }

    const markSingleRead = (id: string) => {
        setNotifications((prev) => {
            const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            saveNotifications(userRole, updated, currentUserId)
            setUnreadCount(updated.filter((n) => !n.read).length)
            return updated
        })
    }

    const removeNotification = (id: string) => {
        setNotifications((prev) => {
            const updated = prev.filter((n) => n.id !== id)
            setUnreadCount(updated.filter((n) => !n.read).length)
            saveNotifications(userRole, updated, currentUserId)
            return updated
        })
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-accent/50 transition-colors focus:outline-none">
                <Bell className="size-4 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none shadow-sm">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent
                className="w-80 sm:w-96 p-0 shadow-lg border border-border"
                align="end"
                sideOffset={8}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                            Notifications
                        </p>
                        {unreadCount > 0 && (
                            <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-300">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                            onClick={markAllRead}
                        >
                            <Check className="size-3 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>

                <DropdownMenuGroup className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
                    {loading && notifications.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Bell className="size-8 text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">
                                Events will appear here in real time
                            </p>
                        </div>
                    ) : (
                        notifications.slice(0, 30).map((notif) => {
                            const Icon = NOTIFICATION_ICONS[notif.type] || Bell
                            const colorClasses = NOTIFICATION_COLORS[notif.type] || "text-zinc-500 bg-zinc-50"
                            const isUnread = !notif.read

                            return (
                                <DropdownMenuItem
                                    key={notif.id}
                                    className={cn(
                                        "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors focus:bg-accent/60",
                                        isUnread
                                            ? "bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-50/90 dark:hover:bg-blue-950/30"
                                            : "bg-transparent hover:bg-muted/40"
                                    )}
                                    onClick={() => {
                                        markSingleRead(notif.id)
                                        if (notif.link) {
                                            window.location.href = notif.link
                                        }
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "flex size-9 shrink-0 items-center justify-center rounded-full mt-0.5",
                                            colorClasses
                                        )}
                                    >
                                        <Icon className="size-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className={cn(
                                                "text-xs text-foreground truncate",
                                                isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                                            )}>
                                                {notif.title}
                                            </p>
                                            {isUnread && (
                                                <span className="size-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                                            )}
                                        </div>
                                        <p className={cn(
                                            "text-xs line-clamp-2 mt-0.5",
                                            isUnread ? "text-foreground/90 font-medium" : "text-muted-foreground"
                                        )}>
                                            {notif.message}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/70 mt-1">{notif.time}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 shrink-0 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 mt-0.5 cursor-pointer opacity-0 group-hover:opacity-100 hover:opacity-100"
                                        title="Dismiss notification"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            removeNotification(notif.id)
                                        }}
                                    >
                                        <X className="size-3" />
                                    </Button>
                                </DropdownMenuItem>
                            )
                        })
                    )}
                </DropdownMenuGroup>

                {notifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="px-4 py-2 bg-muted/10">
                            <p className="text-[11px] text-muted-foreground text-center font-medium">
                                {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}