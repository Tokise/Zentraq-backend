"use client"

import { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Bell, CheckCircle2, AlertCircle } from "lucide-react"
import { getNotifications, markNotificationRead } from "@/app/actions/notifications"
import { toast } from "sonner"


const PAGE_SIZE = 10

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const result = await getNotifications()
      if (result.error) {
        toast.error(result.error)
        setNotifications([])
      } else {
        setNotifications(result.data || [])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notifications
    return notifications.filter((n) => {
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    })
  }, [notifications, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE) as any[]
  }, [filtered, currentPage])

  const handleMarkRead = async (id: string) => {
    const result = await markNotificationRead(id)
    if (!result.error) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    }
  }

  const typeBadge = (type: string) => {
    const variants: Record<string, string> = {
      info: "bg-blue-50 text-blue-700 border-blue-200",
      warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
      error: "bg-red-50 text-red-700 border-red-200",
      success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    }
    return <Badge variant="outline" className={`text-[10px] ${variants[type] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{type}</Badge>
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Notifications"
        description="View and manage system notifications."
      />

      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notifications..."
          className="h-9 pl-8 text-sm"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500">
            <Search className="size-3.5" />
          </button>
        )}
      </div>

      <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="size-9 rounded-full bg-zinc-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-zinc-100 rounded" />
                    <div className="h-2.5 w-24 bg-zinc-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-1.5">
              <Bell className="size-7 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No notifications</p>
              <p className="text-xs text-zinc-400">Notifications will appear here.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Status</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((n) => (
                    <TableRow key={n.id} className={n.read ? "opacity-60" : "bg-zinc-50/30"}>
                      <TableCell>
                        {n.read ? (
                          <CheckCircle2 className="size-4 text-zinc-400" />
                        ) : (
                          <AlertCircle className="size-4 text-blue-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-zinc-400 line-clamp-1">{n.message}</p>
                        </div>
                      </TableCell>
                      <TableCell>{typeBadge(n.type)}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {new Date(n.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {!n.read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkRead(n.id)}
                            className="h-8 text-xs"
                          >
                            Mark read
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!loading && filtered.length > 0 && (
                <div className="px-4 py-3 border-t border-zinc-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filtered.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}