"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Plus, FileText, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getSettingsAction, updateSettingAction } from "@/actions/settings/clinic"

interface Template {
  id: string
  name: string
  content: string
  is_default: boolean
}

export default function AdminClearanceTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", content: "" })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSettingsAction()
      if (res.error) {
        toast.error(res.error)
        return
      }
      const existing = res.settings.find((s) => s.key === "clearance_templates")
      if (existing?.value && Array.isArray(existing.value.templates)) {
        setTemplates(existing.value.templates as Template[])
      } else {
        const defaults: Template[] = [
          {
            id: "default-fit",
            name: "Standard Medical Clearance",
            content: "This certifies that the above-named student has been examined and found medically fit.",
            is_default: true,
          },
          {
            id: "default-conditional",
            name: "Conditional Clearance",
            content: "This certifies that the above-named student is fit with the following conditions...",
            is_default: false,
          },
        ]
        setTemplates(defaults)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load templates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveTemplates = async (next: Template[]) => {
    setSaving(true)
    try {
      const res = await updateSettingAction({ key: "clearance_templates", value: { templates: next } })
      if (res.error) {
        toast.error(res.error)
      } else {
        setTemplates(next)
        toast.success("Templates saved")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error("Template name and content are required")
      return
    }
    if (editingId) {
      const next = templates.map((t) =>
        t.id === editingId ? { ...t, name: form.name.trim(), content: form.content.trim() } : t
      )
      await saveTemplates(next)
    } else {
      await saveTemplates([
        ...templates,
        { id: `t-${Date.now()}`, name: form.name.trim(), content: form.content.trim(), is_default: templates.length === 0 },
      ])
    }
    setShowForm(false)
    setForm({ name: "", content: "" })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return
    await saveTemplates(templates.filter((t) => t.id !== id))
  }

  const handleSetDefault = async (id: string) => {
    await saveTemplates(templates.map((t) => ({ ...t, is_default: t.id === id })))
  }

  const startEdit = (t: Template) => {
    setEditingId(t.id)
    setForm({ name: t.name, content: t.content })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clearance Templates"
        description="Manage the certificate templates used by the clinic."
      >
        <Button size="sm" onClick={() => { setEditingId(null); setForm({ name: "", content: "" }); setShowForm(true) }} className="cursor-pointer">
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
            <p className="text-sm text-muted-foreground">No templates yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
                  {t.is_default && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                      Default
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-4">{t.content}</p>
                <div className="flex items-center gap-1 pt-2 border-t border-zinc-100">
                  {!t.is_default && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-zinc-500" onClick={() => handleSetDefault(t.id)}>
                      Set default
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" className="size-8 text-zinc-400" onClick={() => startEdit(t)}>
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
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sports Clearance" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Certificate Content</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="This certifies that..."
                rows={5}
              />
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