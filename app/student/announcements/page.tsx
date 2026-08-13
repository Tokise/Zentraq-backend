"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Megaphone } from "lucide-react"
import { toast } from "sonner"
import { getAnnouncementsAction } from "@/actions/communications/announcements"

export default function StudentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAnnouncementsAction()
      if (res.error) {
        toast.error(res.error)
        setAnnouncements([])
      } else {
        setAnnouncements(res.announcements)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load announcements")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const priorityBadge = (priority: string | null) => {
    const styles: Record<string, string> = {
      high: "bg-red-50 text-red-700 border-red-200",
      medium: "bg-amber-50 text-amber-700 border-amber-200",
      low: "bg-blue-50 text-blue-700 border-blue-200",
    }
    return <Badge variant="outline" className={`text-[10px] capitalize ${priority ? styles[priority] || "bg-zinc-50 text-zinc-700 border-zinc-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>{priority || "—"}</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Health clinic announcements and updates." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-16 text-center">
              <Megaphone className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No announcements at this time.</p>
            </div>
          ) : (
            <div className="divide-y">
              {announcements.map((a) => (
                <div key={a.id} className="p-4 hover:bg-zinc-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold">{a.title}</h3>
                        {priorityBadge(a.priority)}
                      </div>
                      <p className="text-sm text-zinc-600 mb-2">{a.content}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}