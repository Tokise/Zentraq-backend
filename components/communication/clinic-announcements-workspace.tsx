"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ImageOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  getAnnouncementsAction,
  type AnnouncementDTO,
} from "@/actions/admin/announcements"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const PAGE_SIZE = 10

// Renders the clinic announcement feed without Admin mutation controls.
export function ClinicAnnouncementsWorkspace() {
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Loads the authenticated clinic announcement DTOs.
  const loadAnnouncements = useCallback(async () => {
    setLoading(true)
    const result = await getAnnouncementsAction()
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      setAnnouncements([])
      return
    }
    setAnnouncements(result.announcements)
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadAnnouncements()
    }, 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadAnnouncements])

  const totalPages = Math.ceil(announcements.length / PAGE_SIZE)
  const rows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return announcements.slice(start, start + PAGE_SIZE)
  }, [announcements, page])

  return (
    <div className="space-y-6">
      <PageHeader
        description="Published clinic notices and health-program updates."
        title="Announcements"
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length ? (
        <div className="space-y-4">
          {rows.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <CardTitle>{announcement.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {formatDate(announcement.created_at)}
                  {announcement.poster_name
                    ? ` · ${announcement.poster_name}`
                    : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm">
                  {announcement.content}
                </p>
                {announcement.image_url && (
                  // Published announcement images are public communication assets.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={announcement.title}
                    className="max-h-[36rem] w-full rounded-lg border object-contain"
                    src={announcement.image_url}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ImageOff className="mx-auto mb-2 size-6" />
            No announcements are available.
          </CardContent>
        </Card>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              type="button"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              type="button"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Formats a published timestamp for the current locale.
function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
