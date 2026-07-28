"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Bell, Loader2, X, Check, CalendarDays, Stethoscope, HeartPulse, ClipboardList } from "lucide-react"
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

type Notification = {
    id: string
    type: "appointment" | "consultation" | "emergency" | "visit_log"
    title: string
    message: string
    time: string
    read: boolean
    link?: string
}

const NOTIFICATION_ICONS = {
    appointment: CalendarDays,
    consultation: Stethoscope,
    emergency: HeartPulse,
    visit_log: ClipboardList,
}

const NOTIFICATION_COLORS = {
    appointment: "text-blue-500 bg-blue-50",
    consultation: "text-emerald-500 bg-emerald-50",
    emergency: "text-red-500 bg-red-50",
    visit_log: "text-purple-500 bg-purple-50",
}

type NotificationDropdownProps = {
    userRole?: UserRole
}

export function NotificationDropdown({ userRole = "nurse" }: NotificationDropdownProps) {
    const supabase = createClient()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)
    const [open, setOpen] = useState(false)
    const pollRef = useRef<NodeJS.Timeout | null>(null)

    const isStaff = userRole === "nurse" || userRole === "doctor"
    const isStudentUser = userRole === "student"

    const addNotification = useCallback(
        (type: Notification["type"], title: string, message: string, link?: string) => {
            const newNotif: Notification = {
                id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type,
                title,
                message,
                time: new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                read: false,
                link,
            }
            setNotifications((prev) => [newNotif, ...prev].slice(0, 50))
            setUnreadCount((prev) => prev + 1)
        },
        []
    )

    useEffect(() => {
        setLoading(true)

        const channel = supabase
            .channel("dashboard-notifications")

        let userId: string | null = null

        async function setupChannels() {
            if (isStudentUser) {
                const { data: { user } } = await supabase.auth.getUser()
                userId = user?.id || null
            }

            // Staff (nurse/doctor) get notifications about appointments/consultations
            if (isStaff) {
                channel
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "student_appointments" },
                        (payload: any) => {
                            const apt = payload.new
                            addNotification(
                                "appointment",
                                "New Appointment Booking",
                                `A student booked an appointment on ${apt.appointment_date} at ${apt.time_slot}`,
                                "/appointments/calendar"
                            )
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "UPDATE", schema: "public", table: "student_appointments" },
                        (payload: any) => {
                            const apt = payload.new
                            addNotification(
                                "appointment",
                                "Appointment Updated",
                                `An appointment on ${apt.appointment_date} at ${apt.time_slot} is now "${apt.status}"`,
                                "/appointments/calendar"
                            )
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "consultations" },
                        (payload: any) => {
                            const c = payload.new
                            if (c.origin === "emergency") {
                                addNotification(
                                    "emergency",
                                    "🚨 Emergency Case",
                                    `${c.patient_name} — ${c.student_complaint || "No complaint listed"}`,
                                    "/consultations"
                                )
                            } else {
                                addNotification(
                                    "consultation",
                                    "New Patient Waiting",
                                    `${c.patient_name} is waiting — ${c.student_complaint || "No complaint"}`,
                                    "/consultations"
                                )
                            }
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "UPDATE", schema: "public", table: "consultations" },
                        (payload: any) => {
                            const c = payload.new
                            if (c.status === "in_consultation") {
                                addNotification(
                                    "consultation",
                                    "Consultation Started",
                                    `${c.patient_name} is now in consultation`,
                                    "/consultations"
                                )
                            } else if (c.status === "completed") {
                                addNotification(
                                    "consultation",
                                    "Consultation Completed",
                                    `${c.patient_name}'s consultation has ended`,
                                    "/consultations"
                                )
                            }
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "visit_logs" },
                        (payload: any) => {
                            const v = payload.new
                            addNotification(
                                "visit_log",
                                "Visit Logged",
                                `${v.patient_name} — ${v.student_complaint || "Check-up"} (${v.diagnosis || "Pending"})`,
                                "/consultations/visit-logs"
                            )
                        }
                    )
            }

            // Students see only their own appointment notifications
            if (isStudentUser && userId) {
                channel
                    .on(
                        "postgres_changes",
                        { event: "INSERT", schema: "public", table: "student_appointments", filter: `student_user_id=eq.${userId}` },
                        (payload: any) => {
                            const apt = payload.new
                            addNotification(
                                "appointment",
                                "Appointment Booked",
                                `Your appointment on ${apt.appointment_date} at ${apt.time_slot} is pending confirmation`,
                                "/student/appointments"
                            )
                        }
                    )
                    .on(
                        "postgres_changes",
                        { event: "UPDATE", schema: "public", table: "student_appointments", filter: `student_user_id=eq.${userId}` },
                        (payload: any) => {
                            const apt = payload.new
                            addNotification(
                                "appointment",
                                "Appointment Updated",
                                `Your appointment on ${apt.appointment_date} at ${apt.time_slot} is now "${apt.status}"`,
                                "/student/appointments"
                            )
                        }
                    )
            }

            channel.subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    setLoading(false)
                }
            })
        }

        setupChannels()

        // Fallback polling
        pollRef.current = setInterval(() => {
            setLoading(false)
        }, 5000)

        return () => {
            supabase.removeChannel(channel)
            if (pollRef.current) {
                clearInterval(pollRef.current)
            }
        }
    }, [supabase, addNotification, isStaff, isStudentUser])

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        setUnreadCount(0)
    }

    const removeNotification = (id: string) => {
        setNotifications((prev) => {
            const updated = prev.filter((n) => n.id !== id)
            const unread = updated.filter((n) => !n.read).length
            setUnreadCount(unread)
            return updated
        })
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-accent/50 transition-colors focus:outline-none">
                <Bell className="size-4 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent
                className="w-80 sm:w-96 p-0"
                align="end"
                sideOffset={8}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <p className="text-sm font-semibold">
                        Notifications
                    </p>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={markAllRead}
                        >
                            <Check className="size-3 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>

                <DropdownMenuGroup className="max-h-[360px] overflow-y-auto">
                    {loading && notifications.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Bell className="size-8 text-zinc-200 mb-2" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                            <p className="text-xs text-zinc-300 mt-0.5">
                                Events will appear here in real time
                            </p>
                        </div>
                    ) : (
                        notifications.slice(0, 20).map((notif) => {
                            const Icon = NOTIFICATION_ICONS[notif.type]
                            const colorClasses = NOTIFICATION_COLORS[notif.type]
                            return (
                                <DropdownMenuItem
                                    key={notif.id}
                                    className={cn(
                                        "flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-zinc-100 last:border-0",
                                        !notif.read && "bg-blue-50/40"
                                    )}
                                    onClick={() => {
                                        removeNotification(notif.id)
                                        if (notif.link) {
                                            window.location.href = notif.link
                                        }
                                    }}
                                    onMouseEnter={() => {
                                        if (!notif.read) {
                                            setNotifications((prev) =>
                                                prev.map((n) =>
                                                    n.id === notif.id ? { ...n, read: true } : n
                                                )
                                            )
                                            setUnreadCount((prev) => Math.max(0, prev - 1))
                                        }
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "flex size-8 shrink-0 items-center justify-center rounded-full",
                                            colorClasses
                                        )}
                                    >
                                        <Icon className="size-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {notif.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                            {notif.message}
                                        </p>
                                        <p className="text-[10px] text-zinc-300 mt-1">{notif.time}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 shrink-0 text-zinc-300 hover:text-zinc-500 mt-0.5"
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
                        <div className="px-4 py-2">
                            <p className="text-[11px] text-muted-foreground text-center">
                                {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}