"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SensitiveField } from "@/components/sensitive-field"
import { Button } from "@/components/ui/button"
import { Plus, Calendar } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface MedicalHistory {
  id: string
  condition: string
  diagnosed_date: string | null
  status: string
  notes: string | null
  created_at: string
}

interface MedicalHistorySectionProps {
  history: MedicalHistory[]
  patientId: string
  patientType: "student" | "faculty"
  canEdit: boolean
  onAdd?: (data: any) => Promise<void>
}

export function MedicalHistorySection({ history, patientId, patientType, canEdit, onAdd }: MedicalHistorySectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    condition_name: "",
    diagnosed_date: "",
    status: "active",
    notes: ""
  })

  const handleAdd = async () => {
    if (!formData.condition_name) {
      toast.error("Condition name is required")
      return
    }

    try {
      await onAdd?.(formData)
      setIsAddDialogOpen(false)
      setFormData({ condition_name: "", diagnosed_date: "", status: "active", notes: "" })
      toast.success("Medical history added successfully")
    } catch (error) {
      toast.error("Failed to add medical history")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Medical History</CardTitle>
        {canEdit && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Condition
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Medical Condition</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="condition">Condition Name *</Label>
                  <Input
                    id="condition"
                    value={formData.condition_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, condition_name: e.target.value })}
                    placeholder="e.g., Asthma, Diabetes"
                  />
                </div>
                <div>
                  <Label htmlFor="diagnosed_date">Diagnosed Date</Label>
                  <Input
                    id="diagnosed_date"
                    type="date"
                    value={formData.diagnosed_date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, diagnosed_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="chronic">Chronic</option>
                  </select>
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
                  Add Condition
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medical history recorded.</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <SensitiveField value={item.condition} />
                  <Badge variant={item.status === "active" ? "default" : "secondary"}>
                    {item.status}
                  </Badge>
                </div>
                {item.diagnosed_date && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    Diagnosed: {new Date(item.diagnosed_date).toLocaleDateString()}
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
