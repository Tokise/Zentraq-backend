"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SensitiveField } from "@/components/sensitive-field"
import { Button } from "@/components/ui/button"
import { Syringe, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface Immunization {
  id: string
  vaccine_name: string
  administered_date: string | null
  dose_number: number | null
  lot_number: string | null
  administered_by: string | null
  notes: string | null
  created_at: string
}

interface ImmunizationsSectionProps {
  immunizations: Immunization[]
  patientId: string
  patientType: "student" | "faculty"
  canEdit: boolean
  onAdd?: (data: any) => Promise<void>
}

export function ImmunizationsSection({ immunizations, patientId, patientType, canEdit, onAdd }: ImmunizationsSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    vaccine_name: "",
    administered_date: "",
    dose_number: "",
    lot_number: "",
    notes: ""
  })

  const handleAdd = async () => {
    if (!formData.vaccine_name) {
      toast.error("Vaccine name is required")
      return
    }

    try {
      await onAdd?.(formData)
      setIsAddDialogOpen(false)
      setFormData({ vaccine_name: "", administered_date: "", dose_number: "", lot_number: "", notes: "" })
      toast.success("Immunization added successfully")
    } catch (error) {
      toast.error("Failed to add immunization")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Immunizations</CardTitle>
        {canEdit && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger>
              <Button size="sm" variant="outline">
                <Syringe className="h-4 w-4 mr-2" />
                Add Immunization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Immunization</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="vaccine_name">Vaccine Name *</Label>
                  <Input
                    id="vaccine_name"
                    value={formData.vaccine_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, vaccine_name: e.target.value })}
                    placeholder="e.g., BCG, Hepatitis B, MMR"
                  />
                </div>
                <div>
                  <Label htmlFor="administered_date">Date Administered</Label>
                  <Input
                    id="administered_date"
                    type="date"
                    value={formData.administered_date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, administered_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dose_number">Dose Number</Label>
                  <Input
                    id="dose_number"
                    type="number"
                    value={formData.dose_number}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, dose_number: e.target.value })}
                    placeholder="e.g., 1, 2, 3"
                  />
                </div>
                <div>
                  <Label htmlFor="lot_number">Lot Number</Label>
                  <Input
                    id="lot_number"
                    value={formData.lot_number}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lot_number: e.target.value })}
                    placeholder="e.g., ABC1234"
                  />
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
                  Add Immunization
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {immunizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No immunizations recorded.</p>
        ) : (
          <div className="space-y-3">
            {immunizations.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-muted-foreground" />
                    <SensitiveField value={item.vaccine_name} className="font-medium" />
                  </div>
                  {item.dose_number && (
                    <Badge variant="outline">Dose {item.dose_number}</Badge>
                  )}
                </div>
                {item.administered_date && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    Administered: {new Date(item.administered_date).toLocaleDateString()}
                  </div>
                )}
                {item.lot_number && (
                  <div className="text-xs text-muted-foreground">
                    Lot: <SensitiveField value={item.lot_number} />
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
