"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getFacultyProfileDTO, type FacultyProfileDTO } from "@/actions/faculty/profile"
import { CalendarDays, HeartPulse, FileCheck, Megaphone } from "lucide-react"
import Link from "next/link"

export default function FacultyDashboard() {
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
                console.error("Error loading faculty dashboard data:", err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="Faculty Dashboard"
                description={profile ? `Welcome, ${profile.firstName} ${profile.lastName}` : "Welcome to the faculty portal"}
            />

            {/* Profile card */}
            <Card className="shadow-sm border-zinc-200/80">
                <CardContent className="p-5">
                    {loading ? (
                        <div className="flex items-center gap-4 animate-pulse">
                            <div className="size-16 rounded-2xl bg-zinc-100 shrink-0" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 w-40 bg-zinc-100 rounded" />
                                <div className="h-3 w-24 bg-zinc-100 rounded" />
                            </div>
                        </div>
                    ) : profile ? (
                        <div className="flex items-center gap-4">
                            <div className="size-16 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 shrink-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-zinc-500">
                                    {profile.firstName?.[0]}{profile.lastName?.[0]}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="font-semibold text-base text-zinc-900 truncate">
                                        {profile.firstName} {profile.lastName}
                                    </h2>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {profile.employeeNumber || "N/A"}
                                    </Badge>
                                </div>
                                <p className="text-sm text-zinc-400">{profile.department || "No department on file"}</p>
                                {profile.position && (
                                    <p className="text-xs text-zinc-400">{profile.position}</p>
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
                <Link href="/faculty/appointments/book" className="block">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-2">
                            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <CalendarDays className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Appointments</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            Request and manage your clinic appointments.
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/faculty/staffhealth/my_record" className="block">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-2">
                            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                                <HeartPulse className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Health Records</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            View your medical history and consultations.
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/faculty/clearance/my_history" className="block">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-2">
                            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                                <FileCheck className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Health Clearances</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            Track and request health clearances.
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/faculty/announcements" className="block">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-2">
                            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
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
