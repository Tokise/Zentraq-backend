"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { CalendarDays, Bell, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function StudentDashboard() {
    const supabase = createClient()
    const [profile, setProfile] = useState<any>(null)
    const [appointments, setAppointments] = useState<any[]>([])
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // Load student profile
                const { data: studentData } = await supabase
                    .from("student_accounts")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle()

                setProfile(studentData)

                // Load upcoming appointments
                const { data: appointmentData } = await supabase
                    .from("student_appointments")
                    .select("*")
                    .eq("student_user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(5)

                setAppointments(appointmentData || [])

                // Load recent announcements
                const { data: announcementData } = await supabase
                    .from("announcements")
                    .select("*")
                    .order("created_at", { ascending: false })
                    .limit(5)

                setAnnouncements(announcementData || [])
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [supabase])

    return (
        <div className="space-y-6">
            <PageHeader
                title="Student Dashboard"
                description={profile ? `Welcome, ${profile.first_name} ${profile.last_name}` : "Welcome to the student portal"}
            />

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Profile</CardTitle>
                        <User className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {profile ? (
                            <div className="text-xs space-y-1">
                                <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                                <p className="text-muted-foreground">{profile.student_number || profile.employee_number}</p>
                                <p className="text-muted-foreground">{profile.department || "N/A"}</p>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">No profile data</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
                        <CalendarDays className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {appointments.length > 0 ? (
                            <div className="space-y-2">
                                {appointments.slice(0, 3).map((apt) => (
                                    <div key={apt.id} className="text-xs border-b pb-1 last:border-0">
                                        <p className="font-medium">{apt.appointment_date} — {apt.time_slot}</p>
                                        <p className="text-muted-foreground truncate">{apt.reason || "No reason"}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">No upcoming appointments</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Recent Announcements</CardTitle>
                        <Bell className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {announcements.length > 0 ? (
                            <div className="space-y-2">
                                {announcements.slice(0, 3).map((ann) => (
                                    <div key={ann.id} className="text-xs border-b pb-1 last:border-0">
                                        <p className="font-medium truncate">{ann.title}</p>
                                        <p className="text-muted-foreground line-clamp-1">{ann.content}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">No announcements</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}