"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pagination } from "@/components/pagination"
import { getStudentAnnouncementsAction, type StudentAnnouncementDTO } from "@/app/student/actions"
import { Bell, ImageOff } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

const PAGE_SIZE = 5

export default function StudentAnnouncementsPage() {
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

    // Auto-pop up targeted announcement detail modal when ?id= parameter is present
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
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="Clinic Announcements"
                description="Stay updated with the latest announcements and news from the student health clinic"
            />

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
                        <ImageOff className="size-6 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No announcements posted yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {paginatedAnnouncements.map((ann) => (
                        <div key={ann.id} className="space-y-3">
                            <Card className="shadow-sm border-zinc-200/80">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-base font-semibold text-zinc-900">{ann.title}</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                                <Bell className="size-3 text-zinc-400 shrink-0" />
                                                Posted {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                                                {ann.posterName ? ` by ${ann.posterName}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                                </CardContent>
                            </Card>

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

                    <div className="pt-2">
                        <Pagination
                            currentPage={safePage}
                            totalPages={totalPages}
                            totalItems={announcements.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setPage}
                        />
                    </div>
                </div>
            )}

            {/* Targeted Announcement Detail Pop-up Dialog */}
            {selectedAnnModal && (
                <Dialog open={!!selectedAnnModal} onOpenChange={() => setSelectedAnnModal(null)}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-semibold">{selectedAnnModal.title}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                Posted {selectedAnnModal.createdAt ? new Date(selectedAnnModal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                {selectedAnnModal.posterName ? ` by ${selectedAnnModal.posterName}` : ""}
                            </p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{selectedAnnModal.content}</p>
                            {selectedAnnModal.imageUrl && (
                                <div className="w-full overflow-hidden rounded-xl border border-border/80 bg-muted/20 p-1 mt-2">
                                    <img
                                        src={selectedAnnModal.imageUrl}
                                        alt={selectedAnnModal.title}
                                        className="w-full h-auto object-contain rounded-lg"
                                    />
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}