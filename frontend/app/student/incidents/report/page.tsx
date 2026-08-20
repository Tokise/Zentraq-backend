"use client"

import { useState } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function StudentIncidentsReportPage() {
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error("Please describe the incident")
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      toast.success("Incident reported")
      setDescription("")
      setSubmitting(false)
    }, 800)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="Report Incident" description="Log an incident that occurred." />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Incident Details</CardTitle>
          <CardDescription className="text-xs">Provide details about the incident.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Description *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe what happened..."
              className="resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting} className="cursor-pointer">
              {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Submitting...</> : <><AlertTriangle className="size-3.5 mr-1" /> Submit Report</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}