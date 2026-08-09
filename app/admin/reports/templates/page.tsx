"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, FileText, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getSettingsAction, updateSettingAction } from "@/actions/admin/settings"

interface ReportTemplate {
  id: string
  name: string
  description: string
  includes: string[]
}

export default function AdminReportTemplatesPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", description: "", includes: "" })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSettingsAction()
      if (res.error) {
        toast.error(res.error)
        return
      }
      const existing = res.settings.find((s) => s.key === "report_templates")
      if (existing?.value && Array.isArray(existing.value.templates)) {
        setTemplates(existing.value.templates as ReportTemplate[])
      } else {
        setTemplates([
          {
            id: "daily",
            name: "Daily Clinic Summary",
            description: "Consultations, incidents, and inventory overview for the day.",
            includes: ["Consultations", "Incidents", "Low stock alerts"],
          },
          {
            id: "monthly",
            name: "Monthly Performance Report",
            description: "Monthly KPI summary for clinic administration.",
            includes: ["Consultations", "Clearances", "Complaints"],
          },
        ])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load report templates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveTemplates = async (next: ReportTemplate[]) => {
    setSaving(true)
    try {
      const res = await updateSettingAction({ key: "report_templates", value: { templates: next } })
      if (res.error) {
        toast.error(res.error)
      } else {
        setTemplates(next)
        toast.success("Report templates saved")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Template name is required")
      return
    }
    const includes = form.includes.split(",").map((s) => s.trim()).filter(Boolean)
    if (editingId) {
      await saveTemplates(templates.map((t) =>
        t.id === editingId ? { ...t, name: form.name.trim(), description: form.description.trim(), includes } : t
      ))
    } else {
      await saveTemplates([
        ...templates,
        { id: `rt-${Date.now()}`, name: form.name.trim(), description: form.description.trim(), includes },
      ])
    }
    setShowForm(false)
    setForm({ name: "", description: "", includes: "" })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report template?")) return
    await saveTemplates(templates.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Templates"
        description="Manage reusable report configurations."
      >
        <Button size="sm" onClick={() => { setEditingId(null); setForm({ name: "", description: "", includes: "" }); setShowForm(true) }} className="cursor-pointer">
          <Plus className="size-3.5 mr-1" /> New Template
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No report templates yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-zinc-500 leading-relaxed">{t.description}</p>
                <div className="flex flex-wrap gap-1">
                  {t.includes.map((inc) => (
                    <Badge key={inc} variant="outline" className="text-[10px] bg-zinc-50 text-zinc-600 border-zinc-200">
                      {inc}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-zinc-100">
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" className="size-8 text-zinc-400" onClick={() => { setEditingId(t.id); setForm({ name: t.name, description: t.description, includes: t.includes.join(", ") }); setShowForm(true) }}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-zinc-400 hover:text-red-500" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Template Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Included Sections (comma-separated)</Label>
              <Input value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} placeholder="Consultations, Incidents, Clearances" className="h-9" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}