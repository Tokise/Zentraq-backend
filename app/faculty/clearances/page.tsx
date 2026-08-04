"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getMyClearances, type Clearance } from "@/app/actions/clearances"
import { FileCheck, Plus } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function FacultyClearancesPage() {
  const [clearances, setClearances] = useState<Clearance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadClearances() {
      setLoading(true)
      try {
        const res = await getMyClearances()
        if (res.error) {
          toast.error(res.error)
        } else {
          setClearances(res.clearances)
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load clearances")
      } finally {
        setLoading(false)
      }
    }
    loadClearances()
  }, [])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      evaluating: "bg-blue-50 text-blue-700 border-blue-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      rejected: "bg-red-50 text-red-700 border-red-200",
    }
    return (
      <Badge variant="outline" className={`text-[10px] capitalize ${map[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto mt-[-25px] px-4 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader
          title="Faculty Health Clearances"
          description="Track medical health clearances for annual faculty evaluation, travel, or administrative requirements."
        />
        <Link href="/faculty/clearances/request">
          <Button className="bg-zinc-900 hover:bg-zinc-800 text-white gap-2 shrink-0">
            <Plus className="size-4" />
            Request Clearance
          </Button>
        </Link>
      </div>

      <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-zinc-100 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileCheck className="size-4 text-emerald-600" />
            Clearance History
          </CardTitle>
          <CardDescription>
            History of submitted medical health clearance requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-zinc-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : clearances.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <FileCheck className="size-8 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No health clearance records found</p>
              <p className="text-xs text-zinc-400">Request a health clearance for annual physical examination or official business.</p>
              <div className="pt-2">
                <Link href="/faculty/clearances/request">
                  <Button size="sm" variant="outline">
                    Request Health Clearance
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {clearances.map((c) => (
                <div key={c.id} className="p-4 sm:p-5 hover:bg-zinc-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 text-sm">{c.purpose || "Faculty Health Clearance"}</span>
                      {statusBadge(c.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>Submitted: {new Date(c.created_at).toLocaleDateString()}</span>
                      {c.expires_at && <span>Expires: {new Date(c.expires_at).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500 font-mono">
                    ID: {c.id.substring(0, 8)}...
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