"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, History } from "lucide-react"
import { toast } from "sonner"
import { getDispensingLogsAction } from "@/actions/admin/medicine-admin"

export default function DoctorDispenseLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDispensingLogsAction()
      if (res.error) {
        toast.error(res.error)
        setLogs([])
      } else {
        setLogs(res.logs)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load dispensing log")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader title="Dispensing Log" description="Your medicine dispensing history." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <History className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No dispensing records yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Medicine</th>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Dispensed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{log.medicine_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{log.patient_name || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{log.quantity}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(log.dispensed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}