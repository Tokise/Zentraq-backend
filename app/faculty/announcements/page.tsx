"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Pagination } from "@/components/pagination"
import { getStudentAnnouncementsAction, type StudentAnnouncementDTO } from "@/app/student/actions"
import { Bell, Megaphone } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PAGE_SIZE = 5

export default function FacultyAnnouncementsPage() {
  const searchParams = useSearchParams()
  const targetId = searchParams.get("id")

  const [announcements, setAnnouncements] = useState<StudentAnnouncementDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedAnnModal, setSelectedAnnModal] = useState<StudentAnnouncementDTO | null>(null)

  async function fetchAnnouncements() {
    try {
      const res = await getStudentAnnouncementsAction()
      if (res.announcements) {
        setAnnouncements(res.announcements)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  useEffect(() => {
    if (targetId && announcements.length > 0) {
      const match = announcements.find((a) => a.id === targetId)
      if (match) {
        setSelectedAnnModal(match)
      }
    }
  }, [targetId, announcements])

  const totalPages = Math.ceil(announcements.length / PAGE_SIZE)
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages))

  const paginatedAnnouncements = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return announcements.slice(start, start + PAGE_SIZE)
  }, [announcements, safePage])

  return (
    <div className="space-y-6 max-w-5xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Clinic Announcements"
        description="Stay updated with official health notices, vaccination drives, and clinic operations."
      />

      <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-zinc-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <Megaphone className="size-8 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No announcements active</p>
              <p className="text-xs text-zinc-400">Clinic announcements and health alerts will be displayed here.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {paginatedAnnouncements.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedAnnModal(item)}
                  className="p-5 hover:bg-zinc-50/70 transition-colors cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-zinc-900 text-sm">{item.title}</span>
                    <span className="text-xs text-zinc-400 shrink-0">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 line-clamp-2">{item.content}</p>
                </div>
              ))}
            </div>
          )}

          {!loading && announcements.length > PAGE_SIZE && (
            <div className="p-4 border-t border-zinc-100">
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={announcements.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAnnModal} onOpenChange={(open) => !open && setSelectedAnnModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{selectedAnnModal?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {selectedAnnModal?.imageUrl && (
              <img
                src={selectedAnnModal.imageUrl}
                alt={selectedAnnModal.title}
                className="w-full max-h-64 object-cover rounded-md border"
              />
            )}
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">{selectedAnnModal?.content}</p>
            <p className="text-xs text-zinc-400 pt-2 border-t">
              Published on {selectedAnnModal?.createdAt ? new Date(selectedAnnModal.createdAt).toLocaleString() : ""}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}