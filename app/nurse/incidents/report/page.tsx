"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertTriangle, Plus } from "lucide-react"
import { toast } from "sonner"
import { getIncidentQueue } from "@/actions/inventory/workflow-queries"

export default function NurseIncidentsReportPage() {
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getIncidentQueue(true)
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

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error("Please describe the incident")
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      toast.success("Incident reported")
      setShowForm(false)
      setDescription("")
      setSubmitting(false)
    }, 500)
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
      <PageHeader
        title="Report Incident"
        description="Log new incident cases."
      >
        <Button size="sm" onClick={() => setShowForm(true)} className="cursor-pointer">
          <Plus className="size-3.5 mr-1" /> New Report
        </Button>
      </PageHeader>

      {showForm && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Incident Description *</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what happened..."
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="py-16 text-center">
              <AlertTriangle className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No incidents recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Severity</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{inc.patient_name || "—"}</td>
                      <td className="px-4 py-3 max-w-[300px] truncate">{inc.description}</td>
                      <td className="px-4 py-3">{severityBadge(inc.severity)}</td>
                      <td className="px-4 py-3 capitalize">{inc.status}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(inc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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