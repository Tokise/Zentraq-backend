"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getFacultyProfileDTO, type FacultyProfileDTO } from "@/actions/faculty/profile"
import { CalendarDays, HeartPulse, FileCheck, Megaphone } from "lucide-react"
import Link from "next/link"

export default function StaffDashboard() {
    const [profile, setProfile] = useState<FacultyProfileDTO | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const res = await getFacultyProfileDTO()
                if (res.profile) {
                    setProfile(res.profile)
                }
            } catch (err) {
                console.error("Error loading staff dashboard data:", err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="Staff Dashboard"
                description={profile ? `Welcome, ${profile.firstName} ${profile.lastName}` : "Welcome to the staff portal"}
            />

            {/* Profile card */}
            <Card className="border-border">
                <CardContent className="p-5">
                    {loading ? (
                        <div className="flex items-center gap-4 animate-pulse">
                            <div className="size-16 bg-muted shrink-0" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 w-40 bg-muted" />
                                <div className="h-3 w-24 bg-muted" />
                            </div>
                        </div>
                    ) : profile ? (
                        <div className="flex items-center gap-4">
                            <div className="size-16 overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-muted-foreground">
                                    {profile.firstName?.[0]}{profile.lastName?.[0]}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="font-semibold text-base text-foreground truncate">
                                        {profile.firstName} {profile.lastName}
                                    </h2>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {profile.employeeNumber || "N/A"}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{profile.department || "No department on file"}</p>
                                {profile.position && (
                                    <p className="text-xs text-muted-foreground">{profile.position}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No profile data found for your account.</p>
                    )}
                </CardContent>
            </Card>

            {/* Quick access cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Link href="/staff/appointments/book" className="block">
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardHeader className="pb-2">
                            <div className="mb-2 flex size-10 items-center justify-center border border-primary/20 bg-primary-soft text-primary">
                                <CalendarDays className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Appointments</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            Request and manage your clinic appointments.
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/staff/staffhealth/my_record" className="block">
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardHeader className="pb-2">
                            <div className="mb-2 flex size-10 items-center justify-center border border-primary/20 bg-primary-soft text-primary">
                                <HeartPulse className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Health Records</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            View your medical history and consultations.
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/staff/clearance/my_history" className="block">
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardHeader className="pb-2">
                            <div className="mb-2 flex size-10 items-center justify-center border border-primary/20 bg-primary-soft text-primary">
                                <FileCheck className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Health Clearances</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            Track and request health clearances.
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/staff/announcements" className="block">
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardHeader className="pb-2">
                            <div className="mb-2 flex size-10 items-center justify-center border border-primary/20 bg-primary-soft text-primary">
                                <Megaphone className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Announcements</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            View clinic announcements and updates.
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}