"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface ClearanceEvaluationFormProps {
  clearanceId: string
  onSubmit: (data: { result: "fit" | "unfit" | "conditional"; medical_notes?: string }) => Promise<void>
}

export function ClearanceEvaluationForm({ clearanceId, onSubmit }: ClearanceEvaluationFormProps) {
  const [result, setResult] = useState<"fit" | "unfit" | "conditional" | null>(null)
  const [medicalNotes, setMedicalNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!result) {
      toast.error("Please select an evaluation result")
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({ result, medical_notes: medicalNotes || undefined })
      setResult(null)
      setMedicalNotes("")
      toast.success("Evaluation recorded successfully")
    } catch (error) {
      toast.error("Failed to record evaluation")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resultOptions = [
    {
      value: "fit" as const,
      label: "Fit",
      description: "Patient is medically fit for the requested clearance",
      icon: CheckCircle,
      color: "text-green-600"
    },
    {
      value: "unfit" as const,
      label: "Unfit",
      description: "Patient is not medically fit for the requested clearance",
      icon: XCircle,
      color: "text-red-600"
    },
    {
      value: "conditional" as const,
      label: "Conditional",
      description: "Patient is fit with certain conditions or restrictions",
      icon: AlertCircle,
      color: "text-amber-600"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medical Evaluation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Evaluation Result *</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            {resultOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setResult(option.value)}
                className={`border rounded-lg p-4 text-left transition-colors hover:bg-accent ${
                  result === option.value ? "bg-accent border-primary" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <option.icon className={`h-5 w-5 ${option.color}`} />
                  <span className="font-medium">{option.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="medical_notes">Medical Notes</Label>
          <Textarea
            id="medical_notes"
            placeholder="Enter medical findings, recommendations, or conditions..."
            value={medicalNotes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMedicalNotes(e.target.value)}
            rows={4}
          />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Recording..." : "Record Evaluation"}
        </Button>
      </CardContent>
    </Card>
  )
}
