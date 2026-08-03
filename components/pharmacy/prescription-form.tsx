"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { MedicineSelector } from "./medicine-selector"
import { type Medicine } from "@/app/actions/prescriptions"
import { toast } from "sonner"

interface PrescriptionFormProps {
  consultationId: string
  onSubmit: (data: {
    medicine_id: string
    dosage?: string
    frequency?: string
    duration_days?: number
    quantity?: number
    instructions?: string
  }) => Promise<void>
}

export function PrescriptionForm({ consultationId, onSubmit }: PrescriptionFormProps) {
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null)
  const [formData, setFormData] = useState({
    dosage: "",
    frequency: "",
    duration_days: "",
    quantity: "",
    instructions: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedMedicine) {
      toast.error("Please select a medicine")
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        medicine_id: selectedMedicine.id,
        dosage: formData.dosage || undefined,
        frequency: formData.frequency || undefined,
        duration_days: formData.duration_days ? parseInt(formData.duration_days) : undefined,
        quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
        instructions: formData.instructions || undefined
      })
      
      // Reset form
      setSelectedMedicine(null)
      setFormData({
        dosage: "",
        frequency: "",
        duration_days: "",
        quantity: "",
        instructions: ""
      })
      toast.success("Prescription created successfully")
    } catch (error) {
      toast.error("Failed to create prescription")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Prescription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Medicine *</Label>
          <MedicineSelector
            onSelect={setSelectedMedicine}
            selectedId={selectedMedicine?.id}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dosage">Dosage</Label>
            <Input
              id="dosage"
              placeholder="e.g., 500mg"
              value={formData.dosage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, dosage: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="frequency">Frequency</Label>
            <Input
              id="frequency"
              placeholder="e.g., Twice daily"
              value={formData.frequency}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, frequency: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="duration">Duration (days)</Label>
            <Input
              id="duration"
              type="number"
              placeholder="e.g., 7"
              value={formData.duration_days}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, duration_days: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="e.g., 14"
              value={formData.quantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, quantity: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="instructions">Instructions</Label>
          <Textarea
            id="instructions"
            placeholder="e.g., Take with food, complete full course"
            value={formData.instructions}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, instructions: e.target.value })}
          />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating..." : "Create Prescription"}
        </Button>
      </CardContent>
    </Card>
  )
}
