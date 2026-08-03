"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Activity, HeartPulse, MapPin } from "lucide-react"
import { toast } from "sonner"

interface IncidentReportFormProps {
  patientType: "student" | "faculty"
  patientId: string
  onSubmit: (data: {
    incident_type: "injury" | "illness" | "emergency"
    description: string
    location?: string
    severity: "minor" | "moderate" | "severe" | "critical"
  }) => Promise<void>
}

export function IncidentReportForm({ patientType, patientId, onSubmit }: IncidentReportFormProps) {
  const [incidentType, setIncidentType] = useState<"injury" | "illness" | "emergency" | null>(null)
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [severity, setSeverity] = useState<"minor" | "moderate" | "severe" | "critical">("moderate")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!incidentType) {
      toast.error("Please select an incident type")
      return
    }

    if (!description.trim()) {
      toast.error("Please provide a description of the incident")
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        incident_type: incidentType,
        description,
        location: location || undefined,
        severity
      })
      setIncidentType(null)
      setDescription("")
      setLocation("")
      setSeverity("moderate")
      toast.success("Incident reported successfully")
    } catch (error) {
      toast.error("Failed to report incident")
    } finally {
      setIsSubmitting(false)
    }
  }

  const incidentTypes = [
    {
      value: "injury" as const,
      label: "Injury",
      description: "Physical injury, accident, trauma",
      icon: AlertTriangle,
      color: "text-orange-600"
    },
    {
      value: "illness" as const,
      label: "Illness",
      description: "Sudden illness, sickness, health condition",
      icon: Activity,
      color: "text-blue-600"
    },
    {
      value: "emergency" as const,
      label: "Emergency",
      description: "Life-threatening situation, urgent care needed",
      icon: HeartPulse,
      color: "text-red-600"
    }
  ]

  const severityOptions = [
    { value: "minor" as const, label: "Minor", color: "bg-green-100 text-green-800" },
    { value: "moderate" as const, label: "Moderate", color: "bg-yellow-100 text-yellow-800" },
    { value: "severe" as const, label: "Severe", color: "bg-orange-100 text-orange-800" },
    { value: "critical" as const, label: "Critical", color: "bg-red-100 text-red-800" }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Incident</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Incident Type *</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            {incidentTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setIncidentType(type.value)}
                className={`border rounded-lg p-4 text-left transition-colors hover:bg-accent ${
                  incidentType === type.value ? "bg-accent border-primary" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <type.icon className={`h-5 w-5 ${type.color}`} />
                  <span className="font-medium">{type.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            placeholder="Describe what happened, when, and any relevant details..."
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="location">Location</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="location"
              placeholder="e.g., Gym, Classroom 101, Cafeteria"
              value={location}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div>
          <Label>Severity Level</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {severityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSeverity(option.value)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  severity === option.value ? option.color : "bg-muted hover:bg-muted/80"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Reporting..." : "Report Incident"}
        </Button>
      </CardContent>
    </Card>
  )
}
