"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SensitiveField } from "@/components/sensitive-field"
import { Button } from "@/components/ui/button"
import { Plus, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface Allergy {
  id: string
  allergen: string
  reaction: string | null
  severity: string | null
  notes: string | null
  created_at: string
}

interface AllergiesSectionProps {
  allergies: Allergy[]
  patientId: string
  patientType: "student" | "faculty"
  canEdit: boolean
  onAdd?: (data: any) => Promise<void>
}

const severityColors: Record<string, string> = {
  mild: "bg-blue-100 text-blue-800",
  moderate: "bg-yellow-100 text-yellow-800",
  severe: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800"
}

export function AllergiesSection({ allergies, patientId, patientType, canEdit, onAdd }: AllergiesSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    allergen: "",
    reaction: "",
    severity: "mild",
    notes: ""
  })

  const handleAdd = async () => {
    if (!formData.allergen) {
      toast.error("Allergen is required")
      return
    }

    try {
      await onAdd?.(formData)
      setIsAddDialogOpen(false)
      setFormData({ allergen: "", reaction: "", severity: "mild", notes: "" })
      toast.success("Allergy added successfully")
    } catch (error) {
      toast.error("Failed to add allergy")
    }
  }

  const hasSevereAllergies = allergies.some(a => a.severity === "severe" || a.severity === "critical")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Allergies</CardTitle>
          {hasSevereAllergies && (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          )}
        </div>
        {canEdit && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Allergy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Allergy</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="allergen">Allergen *</Label>
                  <Input
                    id="allergen"
                    value={formData.allergen}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, allergen: e.target.value })}
                    placeholder="e.g., Penicillin, Peanuts"
                  />
                </div>
                <div>
                  <Label htmlFor="reaction">Reaction</Label>
                  <Input
                    id="reaction"
                    value={formData.reaction}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, reaction: e.target.value })}
                    placeholder="e.g., Hives, Anaphylaxis"
                  />
                </div>
                <div>
                  <Label htmlFor="severity">Severity</Label>
                  <select
                    id="severity"
                    value={formData.severity}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="critical">Critical</option>
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
                  Add Allergy
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {allergies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No allergies recorded.</p>
        ) : (
          <div className="space-y-3">
            {allergies.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <SensitiveField value={item.allergen} className="font-medium" />
                    {item.reaction && (
                      <SensitiveField value={item.reaction} className="text-sm text-muted-foreground" />
                    )}
                  </div>
                  {item.severity && (
                    <Badge className={severityColors[item.severity] || ""}>
                      {item.severity}
                    </Badge>
                  )}
                </div>
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
