"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DataTablePagination, useTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { CalendarX } from "lucide-react"
import { toast } from "sonner"
import { getExpiringMedicinesAction } from "@/actions/admin/medicine/operations"

export default function AdminMedicineExpiryPage() {
  const [items, setItems] = useState<Array<{
    id: string
    medicine_id: string
    medicine_name: string | null
    batch_number: string | null
    quantity: number
    expiry_date: string | null
    location: string | null
  }>>([])
  const [loading, setLoading] = useState(true)
  const pagination = useTablePagination(items)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getExpiringMedicinesAction(90)
      if (res.error) {
        toast.error(res.error)
        setItems([])
      } else {
        setItems(res.items)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load expiring medicines")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const daysUntil = (date: string | null) => {
    if (!date) return null
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  const urgencyBadge = (days: number | null) => {
    if (days === null) return null
    if (days < 0) return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Expired</Badge>
    if (days <= 30) return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Critical</Badge>
    if (days <= 60) return <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Soon</Badge>
    return <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">Watch</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiring Medicines"
        description="Medicines expiring within the next 90 days."
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarX className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No medicines expiring within 90 days.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((item) => {
                    const days = daysUntil(item.expiry_date)
                    return (
                      <TableRow key={item.id} className="hover:bg-zinc-50/50">
                        <TableCell className="font-medium">{item.medicine_name || "—"}</TableCell>
                        <TableCell className="text-sm font-mono text-zinc-600">{item.batch_number || "—"}</TableCell>
                        <TableCell className="text-sm font-semibold">{item.quantity}</TableCell>
                        <TableCell className="text-sm text-zinc-600">
                          {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">{days !== null ? days : "—"}</TableCell>
                        <TableCell className="text-sm text-zinc-500">{item.location || "—"}</TableCell>
                        <TableCell>{urgencyBadge(days)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <DataTablePagination
        currentPage={pagination.currentPage}
        onPageChange={pagination.setCurrentPage}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        totalPages={pagination.totalPages}
      />
    </div>
  )
}
