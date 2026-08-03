"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Syringe, Activity, Heart } from "lucide-react"
import { toast } from "sonner"

interface ProgramFormProps {
  onSubmit: (data: {
    name: string
    description?: string
    program_type: "immunization" | "screening" | "wellness"
    start_date?: string
    end_date?: string
  }) => Promise<void>
}

export function ProgramForm({ onSubmit }: ProgramFormProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [programType, setProgramType] = useState<"immunization" | "screening" | "wellness" | null>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Program name is required")
      return
    }

    if (!programType) {
      toast.error("Please select a program type")
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        name,
        description: description || undefined,
        program_type: programType,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      })
      setName("")
      setDescription("")
      setProgramType(null)
      setStartDate("")
      setEndDate("")
      toast.success("Health program created successfully")
    } catch (error) {
      toast.error("Failed to create health program")
    } finally {
      setIsSubmitting(false)
    }
  }

  const programTypes = [
    {
      value: "immunization" as const,
      label: "Immunization",
      description: "Vaccination programs and immunization campaigns",
      icon: Syringe,
      color: "text-blue-600"
    },
    {
      value: "screening" as const,
      label: "Screening",
      description: "Health screenings and check-up programs",
      icon: Activity,
      color: "text-green-600"
    },
    {
      value: "wellness" as const,
      label: "Wellness",
      description: "Wellness programs and health education",
      icon: Heart,
      color: "text-pink-600"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Health Program</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name">Program Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Annual Flu Vaccination, Vision Screening"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </div>

        <div>
          <Label>Program Type *</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            {programTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setProgramType(type.value)}
                className={`border rounded-lg p-4 text-left transition-colors hover:bg-accent ${
                  programType === type.value ? "bg-accent border-primary" : ""
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
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the program objectives, target audience, and activities..."
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating..." : "Create Program"}
        </Button>
      </CardContent>
    </Card>
  )
}
