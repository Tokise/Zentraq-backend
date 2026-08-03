"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ClearanceRequestFormProps {
  requesterType: "student" | "faculty"
  requesterId: string
  onSubmit: (data: { purpose: string }) => Promise<void>
}

export function ClearanceRequestForm({ requesterType, requesterId, onSubmit }: ClearanceRequestFormProps) {
  const [purpose, setPurpose] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!purpose.trim()) {
      toast.error("Please provide a purpose for the clearance")
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({ purpose })
      setPurpose("")
      toast.success("Clearance request submitted successfully")
    } catch (error) {
      toast.error("Failed to submit clearance request")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Health Clearance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="purpose">Purpose *</Label>
          <Textarea
            id="purpose"
            placeholder="e.g., Sports participation, Employment, Travel requirement"
            value={purpose}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPurpose(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Please describe the reason for requiring this health clearance.
          </p>
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Submitting..." : "Submit Request"}
        </Button>
      </CardContent>
    </Card>
  )
}
