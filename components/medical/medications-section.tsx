"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SensitiveField } from "@/components/sensitive-field"
import { Button } from "@/components/ui/button"
import { Pill, Calendar, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface Medication {
  id: string
  medicine_name: string
  dosage: string | null
  frequency: string | null
  start_date: string | null
  end_date: string | null
  prescribed_by: string | null
  notes: string | null
  created_at: string
}

interface MedicationsSectionProps {
  medications: Medication[]
  patientId: string
  patientType: "student" | "faculty"
  canEdit: boolean
  onAdd?: (data: any) => Promise<void>
}

export function MedicationsSection({ medications, patientId, patientType, canEdit, onAdd }: MedicationsSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    medicine_name: "",
    dosage: "",
    frequency: "",
    start_date: "",
    end_date: "",
    notes: ""
  })

  const handleAdd = async () => {
    if (!formData.medicine_name) {
      toast.error("Medicine name is required")
      return
    }

    try {
      await onAdd?.(formData)
      setIsAddDialogOpen(false)
      setFormData({ medicine_name: "", dosage: "", frequency: "", start_date: "", end_date: "", notes: "" })
      toast.success("Medication added successfully")
    } catch (error) {
      toast.error("Failed to add medication")
    }
  }

  const activeMedications = medications.filter(m => !m.end_date || new Date(m.end_date) >= new Date())

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Current Medications</CardTitle>
        {canEdit && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger>
              <Button size="sm" variant="outline">
                <Pill className="h-4 w-4 mr-2" />
                Add Medication
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Medication</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="medicine_name">Medicine Name *</Label>
                  <Input
                    id="medicine_name"
                    value={formData.medicine_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, medicine_name: e.target.value })}
                    placeholder="e.g., Amoxicillin 500mg"
                  />
                </div>
                <div>
                  <Label htmlFor="dosage">Dosage</Label>
                  <Input
                    id="dosage"
                    value={formData.dosage}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, dosage: e.target.value })}
                    placeholder="e.g., 1 tablet twice daily"
                  />
                </div>
                <div>
                  <Label htmlFor="frequency">Frequency</Label>
                  <Input
                    id="frequency"
                    value={formData.frequency}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, frequency: e.target.value })}
                    placeholder="e.g., Every 8 hours"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>
                <Button onClick={handleAdd} className="w-full">
                  Add Medication
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {activeMedications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No current medications recorded.</p>
        ) : (
          <div className="space-y-3">
            {activeMedications.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-muted-foreground" />
                    <SensitiveField value={item.medicine_name} className="font-medium" />
                  </div>
                  {item.end_date && new Date(item.end_date) < new Date() && (
                    <Badge variant="secondary">Completed</Badge>
                  )}
                </div>
                {item.dosage && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    <SensitiveField value={`${item.dosage}${item.frequency ? ` - ${item.frequency}` : ""}`} />
                  </div>
                )}
                {(item.start_date || item.end_date) && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {item.start_date && `Started: ${new Date(item.start_date).toLocaleDateString()}`}
                    {item.start_date && item.end_date && " | "}
                    {item.end_date && `Ends: ${new Date(item.end_date).toLocaleDateString()}`}
                  </div>
                )}
                {item.notes && (
                  <SensitiveField value={item.notes} className="text-sm text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
