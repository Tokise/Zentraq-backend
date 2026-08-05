"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStudentProfileDTO, getStudentAnnouncementsAction, type StudentProfileDTO, type StudentAnnouncementDTO } from "@/actions/student/profile"
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
                                {profile.clinicPhotoUrl ? (
                                    <img src={profile.clinicPhotoUrl} alt="Profile" className="size-full object-cover" />
                                ) : (
                                    <span className="text-lg font-bold text-muted-foreground">
                                        {profile.firstName?.[0]}{profile.lastName?.[0]}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="font-semibold text-base text-foreground truncate">
                                        {profile.firstName} {profile.lastName}
                                    </h2>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {profile.studentNumber || profile.employeeNumber || "N/A"}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{profile.department || "No department on file"}</p>
                                {profile.course && (
                                    <p className="text-xs text-muted-foreground">{profile.course}{profile.yearLevel ? ` • ${profile.yearLevel}` : ""}</p>
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
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Bell className="size-4 text-muted-foreground" /> Announcements
                    </h3>
                    <Link
                        href="/student/announcements"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                    >
                        View all <ArrowRight className="size-3" />
                    </Link>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2].map((i) => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-4">
                                    <div className="h-4 w-48 bg-muted mb-3" />
                                    <div className="h-3 w-full bg-muted mb-2" />
                                    <div className="h-3 w-2/3 bg-muted" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : announcements.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center">
                            <ImageOff className="size-6 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No announcements yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {announcements.map((ann) => (
                            <div key={ann.id} className="space-y-2">
                                {/* Card for text content ON TOP */}
                                <Card>
                                    <CardHeader className="pb-1.5">
                                        <CardTitle className="text-sm font-semibold">{ann.title}</CardTitle>
                                        <p className="text-[11px] text-muted-foreground">
                                            {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                            {ann.posterName ? ` • ${ann.posterName}` : ""}
                                        </p>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                                    </CardContent>
                                </Card>

                                {/* Full-length picture standalone below the text card */}
                                {ann.imageUrl && (
                                    <div className="w-full overflow-hidden border border-border bg-muted/20">
                                        <img
                                            src={ann.imageUrl}
                                            alt={ann.title}
                                            className="w-full h-auto object-contain"
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