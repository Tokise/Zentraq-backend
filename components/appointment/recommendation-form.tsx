"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Calendar, Clock } from "lucide-react"
import { toast } from "sonner"

interface RecommendationFormProps {
  appointmentId: string
  onSubmit: (data: {
    recommendation: "approve" | "reject" | "reschedule"
    notes?: string
    recommended_date?: string
    recommended_time?: string
  }) => Promise<void>
}

export function RecommendationForm({ appointmentId, onSubmit }: RecommendationFormProps) {
  const [recommendation, setRecommendation] = useState<"approve" | "reject" | "reschedule" | null>(null)
  const [notes, setNotes] = useState("")
  const [recommendedDate, setRecommendedDate] = useState("")
  const [recommendedTime, setRecommendedTime] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!recommendation) {
      toast.error("Please select a recommendation")
      return
    }

    if (recommendation === "reschedule" && (!recommendedDate || !recommendedTime)) {
      toast.error("Please provide date and time for rescheduling")
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        recommendation,
        notes: notes || undefined,
        recommended_date: recommendation === "reschedule" ? recommendedDate : undefined,
        recommended_time: recommendation === "reschedule" ? recommendedTime : undefined
      })
      setRecommendation(null)
      setNotes("")
      setRecommendedDate("")
      setRecommendedTime("")
      toast.success("Recommendation recorded successfully")
    } catch (error) {
      toast.error("Failed to record recommendation")
    } finally {
      setIsSubmitting(false)
    }
  }

  const recommendations = [
    {
      value: "approve" as const,
      label: "Approve",
      description: "Approve this appointment as requested",
      icon: Check,
      color: "text-green-600"
    },
    {
      value: "reject" as const,
      label: "Reject",
      description: "Reject this appointment request",
      icon: X,
      color: "text-red-600"
    },
    {
      value: "reschedule" as const,
      label: "Reschedule",
      description: "Reschedule to a different time",
      icon: Calendar,
      color: "text-amber-600"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Recommendation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Recommendation *</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            {recommendations.map((rec) => (
              <button
                key={rec.value}
                type="button"
                onClick={() => setRecommendation(rec.value)}
                className={`border rounded-lg p-4 text-left transition-colors hover:bg-accent ${
                  recommendation === rec.value ? "bg-accent border-primary" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <rec.icon className={`h-5 w-5 ${rec.color}`} />
                  <span className="font-medium">{rec.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{rec.description}</p>
              </button>
            ))}
          </div>
        </div>

        {recommendation === "reschedule" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recommended_date">New Date *</Label>
              <Input
                id="recommended_date"
                type="date"
                value={recommendedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecommendedDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="recommended_time">New Time *</Label>
              <Input
                id="recommended_time"
                type="time"
                value={recommendedTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecommendedTime(e.target.value)}
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Add any additional notes or reasoning..."
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Recording..." : "Record Recommendation"}
        </Button>
      </CardContent>
    </Card>
  )
}
