"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function FacultyClearanceRequestPage() {
  const [purpose, setPurpose] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!purpose.trim()) {
      toast.error("Please enter a purpose for the clearance")
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      toast.success("Clearance request submitted")
      setPurpose("")
      setNotes("")
      setSubmitting(false)
    }, 800)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="Request Clearance" description="Submit a medical clearance request." />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Clearance Details</CardTitle>
          <CardDescription className="text-xs">Fill out the form below to request medical clearance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Purpose *</label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Sports activity, Field trip, Surgery"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Additional Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Any additional information..."
              className="resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting} className="cursor-pointer">
              {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Submitting...</> : <><FileText className="size-3.5 mr-1" /> Submit Request</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}