"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Plus, Trash2, CheckSquare, Square } from "lucide-react"
import { toast } from "sonner"
import { getSettingsAction, updateSettingAction } from "@/actions/admin/settings"

interface Requirement {
  id: string
  name: string
  required: boolean
}

export default function AdminClearanceRequirementsPage() {
  const [requirements, setRequirements] = useState<Record<string, Requirement[]>>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newReqName, setNewReqName] = useState("")
  const [newReqType, setNewReqType] = useState("student")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSettingsAction()
      if (res.error) {
        toast.error(res.error)
        return
      }
      const existing = res.settings.find((s) => s.key === "clearance_requirements")
      if (existing?.value && typeof existing.value === "object") {
        setRequirements(existing.value as Record<string, Requirement[]>)
      } else {
        setRequirements({
          student: [
            { id: "st-1", name: "Valid student ID", required: true },
            { id: "st-2", name: "Completed medical history form", required: true },
            { id: "st-3", name: "Updated immunization records", required: false },
          ],
          faculty: [
            { id: "fc-1", name: "Valid employee ID", required: true },
            { id: "fc-2", name: "Completed medical history form", required: true },
            { id: "fc-3", name: "Updated immunization records", required: false },
          ],
        })
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load requirements")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveRequirements = async (next: Record<string, Requirement[]>) => {
    setSaving(true)
    try {
      const res = await updateSettingAction({ key: "clearance_requirements", value: next })
      if (res.error) {
        toast.error(res.error)
      } else {
        setRequirements(next)
        toast.success("Requirements saved")
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleRequired = (type: string, id: string) => {
    const next = {
      ...requirements,
      [type]: requirements[type]?.map((r) =>
        r.id === id ? { ...r, required: !r.required } : r
      ) || [],
    }
    saveRequirements(next)
  }

  const removeRequirement = (type: string, id: string) => {
    if (!confirm("Remove this requirement?")) return
    const next = {
      ...requirements,
      [type]: (requirements[type] || []).filter((r) => r.id !== id),
    }
    saveRequirements(next)
  }

  const addRequirement = async () => {
    if (!newReqName.trim()) {
      toast.error("Requirement name is required")
      return
    }
    const next = {
      ...requirements,
      [newReqType]: [
        ...(requirements[newReqType] || []),
        { id: `${newReqType}-${Date.now()}`, name: newReqName.trim(), required: true },
      ],
    }
    await saveRequirements(next)
    setNewReqName("")
    setShowAdd(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clearance Requirements"
        description="Configure the requirements needed for each clearance type."
      >
        <Button size="sm" onClick={() => setShowAdd(true)} className="cursor-pointer">
          <Plus className="size-3.5 mr-1" /> Add Requirement
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(requirements).map(([type, items]) => (
            <Card key={type} className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base capitalize">{type} Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No requirements configured.</p>
                ) : (
                  items.map((req) => (
                    <div key={req.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50/50 transition-colors">
                      <button
                        onClick={() => toggleRequired(type, req.id)}
                        className="text-zinc-400 hover:text-zinc-600 cursor-pointer shrink-0"
                        title={req.required ? "Required" : "Optional"}
                      >
                        {req.required ? <CheckSquare className="size-4 text-zinc-900" /> : <Square className="size-4" />}
                      </button>
                      <span className="text-sm flex-1">{req.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${req.required ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                        {req.required ? "Required" : "Optional"}
                      </Badge>
                      <button
                        onClick={() => removeRequirement(type, req.id)}
                        className="text-zinc-300 hover:text-red-500 cursor-pointer shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Requirement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Requirement Name</Label>
              <Input value={newReqName} onChange={(e) => setNewReqName(e.target.value)} placeholder="e.g. Chest X-ray report" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Clearance Type</Label>
              <select
                value={newReqType}
                onChange={(e) => setNewReqType(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addRequirement} disabled={saving}>
              {saving ? "Saving..." : "Add Requirement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}