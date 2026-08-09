"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Bell, Loader2, X, Check, CalendarDays, Stethoscope, HeartPulse, ClipboardList, ShieldCheck, Megaphone, FileCheck, Pill } from "lucide-react"
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
import { createClient } from "@/utils/supabase/client"
import type { UserRole } from "@/lib/auth/roles"
import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    type NotificationDTO,
    type NotificationType,
} from "@/actions/system/notifications"

const NOTIFICATION_ICONS: Record<string, any> = {
    appointment: CalendarDays,
    consultation: Stethoscope,
    emergency: HeartPulse,
    visit_log: ClipboardList,
    system: Megaphone,
    rfid: ShieldCheck,
    clearance: FileCheck,
    service: Pill,
}

const NOTIFICATION_COLORS: Record<string, string> = {
    appointment: "text-blue-500 bg-blue-50",
    consultation: "text-emerald-500 bg-emerald-50",
    emergency: "text-red-500 bg-red-50",
    visit_log: "text-purple-500 bg-purple-50",
    system: "text-indigo-500 bg-indigo-50",
    rfid: "text-amber-500 bg-amber-50",
    clearance: "text-cyan-500 bg-cyan-50",
    service: "text-rose-500 bg-rose-50",
}

// Map related_resource to a route for click-to-navigate
const RESOURCE_ROUTES: Record<string, (id: string) => string> = {
    appointment: (id) => `/appointments/calendar?id=${id}`,
    consultation: (id) => `/consultations?id=${id}`,
    emergency: (id) => `/consultations/emergency?id=${id}`,
    visit_log: (id) => `/consultations/visit-logs?id=${id}`,
    announcement: (id) => `/admin/announcement?id=${id}`,
    student: (id) => `/admin/rfid-registration?id=${id}`,
    role: () => `/admin/useraccess/roles`,
    service: (id) => `/admin/healthprograms/list?id=${id}`,
    setting: () => `/admin`,
}

function getRelativeTime(iso: string): string {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    const diffWeeks = Math.floor(diffDays / 7)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`

    // Yesterday / days / weeks
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()
    if (isYesterday) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? "s" : ""} ago`

    // Fall back to a date
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// Build navigation href from notification
function getNotificationHref(n: NotificationDTO): string | undefined {
    if (!n.related_resource) return undefined
    const routeBuilder = RESOURCE_ROUTES[n.related_resource]
    if (!routeBuilder) return undefined
    return routeBuilder(n.related_resource_id || "")
}

type NotificationDropdownProps = {
    userRole?: UserRole
}

export function NotificationDropdown({ userRole = "nurse" }: NotificationDropdownProps) {
    const [notifications, setNotifications] = useState<NotificationDTO[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const hasFetchedRef = useRef(false)

    // Load unread count on mount (lightweight â€” always keep in sync)
    const refreshUnreadCount = useCallback(async () => {
        const res = await getUnreadNotificationCount()
        if (!res.error) {
            setUnreadCount(res.count)
        }
    }, [])

    // Load notification list when dropdown opens (lazy load)
    const loadNotifications = useCallback(async () => {
        setLoading(true)
        const res = await getNotifications({ limit: 20 })
        if (!res.error) {
            setNotifications(res.notifications)
        }
        setLoading(false)
        await refreshUnreadCount()
    }, [refreshUnreadCount])

    // Fetch unread count on mount and set up a polling interval
    useEffect(() => {
        refreshUnreadCount()
        const interval = setInterval(refreshUnreadCount, 30000)
        return () => clearInterval(interval)
    }, [refreshUnreadCount])

    // Subscribes only to the signed-in user's notification inserts.
    useEffect(() => {
        const supabase = createClient()
        let channel: ReturnType<typeof supabase.channel> | null = null
        let active = true

        async function subscribe() {
            const { data } = await supabase.auth.getUser()
            if (!active || !data.user) return
            channel = supabase
                .channel(`notifications:${data.user.id}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "notifications",
                        filter: `receiver_id=eq.${data.user.id}`,
                    },
                    () => {
                        void refreshUnreadCount()
                        if (open) void loadNotifications()
                    },
                )
                .subscribe()
        }

        void subscribe()
        return () => {
            active = false
            if (channel) void supabase.removeChannel(channel)
        }
    }, [loadNotifications, open, refreshUnreadCount])

    // When dropdown opens, fetch the latest notifications (if not already fetched recently)
    useEffect(() => {
        if (open) {
            loadNotifications()
            hasFetchedRef.current = true
        }
    }, [open, loadNotifications])

    const handleMarkSingle = async (id: string, isRead: boolean) => {
        // Optimistic update
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: isRead } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev + (isRead ? -1 : 1)))

        const res = await markNotificationAsRead(id, isRead)
        if (res.error) {
            // Revert on failure
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: !isRead } : n))
            )
            setUnreadCount((prev) => prev + (isRead ? 1 : -1))
        }
    }

    const handleMarkAllRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        setUnreadCount(0)

        const res = await markAllNotificationsAsRead()
        if (res.error) {
            await loadNotifications()
        }
    }

    const handleDelete = async (id: string) => {
        // Optimistic remove
        const target = notifications.find((n) => n.id === id)
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        if (target && !target.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1))
        }

        const res = await deleteNotification(id)
        if (res.error) {
            // Revert on failure
            await loadNotifications()
            await refreshUnreadCount()
        }
    }

    const handleClickNotification = async (n: NotificationDTO) => {
        if (!n.is_read) {
            await handleMarkSingle(n.id, true)
        }
        const href = getNotificationHref(n)
        if (href) {
            window.location.href = href
        }
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-accent/50 transition-colors focus:outline-none">
                <Bell className="size-4 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent
                className="w-80 sm:w-96 p-0 border border-border"
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
                            onClick={handleMarkAllRead}
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
                                You're all caught up
                            </p>
                        </div>
                    ) : (
                        notifications.map((notif) => {
                            const Icon = NOTIFICATION_ICONS[notif.type] || Bell
                            const colorClasses = NOTIFICATION_COLORS[notif.type] || "text-zinc-500 bg-zinc-50"
                            const isUnread = !notif.is_read

                            return (
                                <DropdownMenuItem
                                    key={notif.id}
                                    className={cn(
                                        "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors focus:bg-accent/60",
                                        isUnread
                                            ? "bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-50/90 dark:hover:bg-blue-950/30"
                                            : "bg-transparent hover:bg-muted/40"
                                    )}
                                    onClick={() => handleClickNotification(notif)}
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
                                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                                            {getRelativeTime(notif.created_at)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 shrink-0 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 mt-0.5 cursor-pointer opacity-0 group-hover:opacity-100 hover:opacity-100"
                                        title="Dismiss notification"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDelete(notif.id)
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
                                {notifications.length} notification{notifications.length !== 1 ? "s" : ""} Â· latest
                            </p>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
