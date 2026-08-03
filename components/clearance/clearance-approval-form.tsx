"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Award } from "lucide-react"
import { toast } from "sonner"

interface ClearanceApprovalFormProps {
  clearanceId: string
  currentStatus: string
  evaluationResult?: string
  medicalNotes?: string
  onApprove: (data: { expires_at?: string }) => Promise<void>
  onReject: (reason: string) => Promise<void>
}

export function ClearanceApprovalForm({
  clearanceId,
  currentStatus,
  evaluationResult,
  medicalNotes,
  onApprove,
  onReject
}: ClearanceApprovalFormProps) {
  const [expiresAt, setExpiresAt] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      await onApprove({ expires_at: expiresAt || undefined })
      setExpiresAt("")
      toast.success("Clearance approved successfully")
    } catch (error) {
      toast.error("Failed to approve clearance")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection")
      return
    }

    setIsSubmitting(true)
    try {
      await onReject(rejectReason)
      setRejectReason("")
      toast.success("Clearance rejected")
    } catch (error) {
      toast.error("Failed to reject clearance")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clearance Approval</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {evaluationResult && (
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4" />
              <span className="font-medium">Medical Evaluation Result</span>
            </div>
            <Badge variant={evaluationResult === "fit" ? "default" : evaluationResult === "unfit" ? "destructive" : "secondary"}>
              {evaluationResult.charAt(0).toUpperCase() + evaluationResult.slice(1)}
            </Badge>
            {medicalNotes && (
              <p className="text-sm text-muted-foreground mt-2">{medicalNotes}</p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="expires_at">Expiry Date (Optional)</Label>
          <Input
            id="expires_at"
            type="date"
            value={expiresAt}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value)}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave blank if clearance does not expire
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleApprove} disabled={isSubmitting || currentStatus === "approved"} className="flex-1">
            <Award className="h-4 w-4 mr-2" />
            {isSubmitting ? "Processing..." : "Approve"}
          </Button>
          <Button
            onClick={handleReject}
            disabled={isSubmitting || currentStatus === "rejected"}
            variant="destructive"
            className="flex-1"
          >
            Reject
          </Button>
        </div>

        <div>
          <Label htmlFor="reject_reason">Rejection Reason</Label>
          <Textarea
            id="reject_reason"
            placeholder="Enter reason for rejection..."
            value={rejectReason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectReason(e.target.value)}
            rows={2}
            className="mt-2"
          />
        </div>
      </CardContent>
    </Card>
  )
}
