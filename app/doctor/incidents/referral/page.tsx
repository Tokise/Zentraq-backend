"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, ArrowRightLeft } from "lucide-react"
import { toast } from "sonner"
import { getIncidentQueue } from "@/actions/inventory/workflow-queries"
import { getIncidentDetailAction, scheduleIncidentFollowUp } from "@/actions/admin/incidents/overview"

export default function DoctorIncidentReferralPage() {
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpNotes, setFollowUpNotes] = useState("")
  const [processing, setProcessing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getIncidentQueue(false)
      if (res.error) {
        toast.error(res.error)
        setIncidents([])
      } else {
        setIncidents(res.incidents)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load incidents")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openReferral = async (id: string) => {
    const res = await getIncidentDetailAction(id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    setSelected(res.incident)
    setFollowUpDate("")
    setFollowUpNotes("")
  }

  const handleRefer = async () => {
    if (!selected || !followUpDate) {
      toast.error("Follow-up date is required for referral")
      return
    }
    setProcessing(true)
    try {
      const res = await scheduleIncidentFollowUp(selected.id, {
        follow_up_date: followUpDate,
        notes: followUpNotes || "Referred for follow-up care",
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Referral scheduled")
        setSelected(null)
        fetchData()
      }
    } finally {
      setProcessing(false)
    }
  }

  const severityBadge = (severity: string | null) => {
    const styles: Record<string, string> = {
      minor: "bg-green-50 text-green-700 border-green-200",
      moderate: "bg-yellow-50 text-yellow-700 border-yellow-200",
      severe: "bg-orange-50 text-orange-700 border-orange-200",
      critical: "bg-red-50 text-red-700 border-red-200",
    }
    return <Badge variant="outline" className={`text-[10px] capitalize ${severity ? styles[severity] || "bg-zinc-50 text-zinc-700 border-zinc-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>{severity || "—"}</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Incident Referrals" description="Schedule follow-up care for incidents." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="py-16 text-center">
              <ArrowRightLeft className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-minc-foreground">No active incidents to refer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Severity</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{inc.patient_name || "—"}</td>
                      <td className="px-4 py-3 max-w-[300px] truncate">{inc.description}</td>
                      <td className="px-4 py-3">{severityBadge(inc.severity)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openReferral(inc.id)}>
                          Refer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Referral</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-sm font-medium">{selected.patient_name || "Patient"}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{selected.description}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Follow-up Date *</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-200 px-3 text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Referral Notes</label>
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={3}
                  placeholder="Reason for referral, specialist to see, etc."
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleRefer} disabled={processing || !followUpDate}>
              {processing ? "Scheduling..." : "Confirm Referral"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}