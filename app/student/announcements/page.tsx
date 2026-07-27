"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"

export default function StudentAnnouncementsPage() {
    const supabase = createClient()
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const { data } = await supabase
                .from("announcements")
                .select("*, profiles:posted_by(email, full_name)")
                .order("created_at", { ascending: false })

            setAnnouncements(data || [])
            setLoading(false)
        }
        load()
    }, [supabase])

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader title="Announcements" description="Latest updates and announcements from the clinic" />

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-5">
                                <div className="h-4 w-48 bg-zinc-100 rounded mb-3" />
                                <div className="h-3 w-full bg-zinc-100 rounded mb-2" />
                                <div className="h-3 w-3/4 bg-zinc-100 rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : announcements.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-sm text-muted-foreground">No announcements yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {announcements.map((ann) => (
                        <Card key={ann.id} className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">{ann.title}</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Posted {ann.created_at ? new Date(ann.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                    {ann.profiles?.full_name ? ` by ${ann.profiles.full_name}` : ""}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm whitespace-pre-wrap">{ann.content}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}