"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStudentProfileDTO, getStudentAnnouncementsAction, type StudentProfileDTO, type StudentAnnouncementDTO } from "./actions"
import { Bell, ArrowRight, ImageOff } from "lucide-react"

export default function StudentDashboard() {
    const [profile, setProfile] = useState<StudentProfileDTO | null>(null)
    const [announcements, setAnnouncements] = useState<StudentAnnouncementDTO[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const [profRes, annRes] = await Promise.all([
                    getStudentProfileDTO(),
                    getStudentAnnouncementsAction(5),
                ])

                if (profRes.profile) {
                    setProfile(profRes.profile)
                }

                if (annRes.announcements) {
                    setAnnouncements(annRes.announcements)
                }
            } catch (err) {
                console.error("Error loading student dashboard data:", err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="Student Dashboard"
                description={profile ? `Welcome, ${profile.firstName} ${profile.lastName}` : "Welcome to the student portal"}
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
                                {profile.clinicPhotoUrl ? (
                                    <img src={profile.clinicPhotoUrl} alt="Profile" className="size-full object-cover" />
                                ) : (
                                    <span className="text-lg font-bold text-zinc-500">
                                        {profile.firstName?.[0]}{profile.lastName?.[0]}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="font-semibold text-base text-zinc-900 truncate">
                                        {profile.firstName} {profile.lastName}
                                    </h2>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {profile.studentNumber || profile.employeeNumber || "N/A"}
                                    </Badge>
                                </div>
                                <p className="text-sm text-zinc-400">{profile.department || "No department on file"}</p>
                                {profile.course && (
                                    <p className="text-xs text-zinc-400">{profile.course}{profile.yearLevel ? ` • ${profile.yearLevel}` : ""}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No profile data found for your account.</p>
                    )}
                </CardContent>
            </Card>

            {/* Announcements feed */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                        <Bell className="size-4 text-zinc-400" /> Announcements
                    </h3>
                    <Link
                        href="/student/announcements"
                        className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-0.5"
                    >
                        View all <ArrowRight className="size-3" />
                    </Link>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2].map((i) => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-4">
                                    <div className="h-4 w-48 bg-zinc-100 rounded mb-3" />
                                    <div className="h-3 w-full bg-zinc-100 rounded mb-2" />
                                    <div className="h-3 w-2/3 bg-zinc-100 rounded" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : announcements.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center">
                            <ImageOff className="size-6 text-zinc-300 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No announcements yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {announcements.map((ann) => (
                            <div key={ann.id} className="space-y-2">
                                {/* Card for text content ON TOP */}
                                <Card className="shadow-sm">
                                    <CardHeader className="pb-1.5">
                                        <CardTitle className="text-sm font-semibold">{ann.title}</CardTitle>
                                        <p className="text-[11px] text-muted-foreground">
                                            {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                            {ann.posterName ? ` • ${ann.posterName}` : ""}
                                        </p>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                                    </CardContent>
                                </Card>

                                {/* Full-length picture standalone below the text card */}
                                {ann.imageUrl && (
                                    <div className="w-full overflow-hidden rounded-xl border border-border/80 bg-muted/20 p-1 shadow-sm">
                                        <img
                                            src={ann.imageUrl}
                                            alt={ann.title}
                                            className="w-full h-auto object-contain rounded-lg"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}