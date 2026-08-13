"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, HeartPulse, Plus } from "lucide-react"
import { toast } from "sonner"
import { getSettingsAction, updateSettingAction } from "@/actions/settings/clinic"

interface HealthProgram {
  id: string
  name: string
  description: string
  target_group: string[]
  active: boolean
}

export default function AdminHealthProgramsPage() {
  const [programs, setPrograms] = useState<HealthProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", description: "", target_group: "", active: true })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSettingsAction()
      if (res.error) {
        toast.error(res.error)
        return
      }
      const existing = res.settings.find((s) => s.key === "health_programs")
      if (existing?.value && Array.isArray(existing.value.programs)) {
        setPrograms(existing.value.programs as HealthProgram[])
      } else {
        setPrograms([
          { id: "hp-1", name: "Annual Physical Exam", description: "Comprehensive health screening for all students and faculty.", target_group: ["students", "faculty"], active: true },
          { id: "hp-2", name: "Dental Check-up", description: "Oral health assessment and cleaning.", target_group: ["students"], active: true },
          { id: "hp-3", name: "Vision Screening", description: "Eye examination and vision correction referral.", target_group: ["students", "faculty"], active: false },
        ])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load programs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const savePrograms = async (next: HealthProgram[]) => {
    setSaving(true)
    try {
      const res = await updateSettingAction({ key: "health_programs", value: { programs: next } })
      if (res.error) {
        toast.error(res.error)
      } else {
        setPrograms(next)
        toast.success("Programs saved")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Program name is required")
      return
    }
    const target_group = form.target_group.split(",").map((s) => s.trim()).filter(Boolean)
    if (editingId) {
      await savePrograms(programs.map((p) =>
        p.id === editingId ? { ...p, name: form.name.trim(), description: form.description.trim(), target_group, active: form.active } : p
      ))
    } else {
      await savePrograms([
        ...programs,
        { id: `hp-${Date.now()}`, name: form.name.trim(), description: form.description.trim(), target_group, active: form.active },
      ])
    }
    setShowForm(false)
    setForm({ name: "", description: "", target_group: "", active: true })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this program?")) return
    await savePrograms(programs.filter((p) => p.id !== id))
  }

  const toggleActive = async (id: string) => {
    await savePrograms(programs.map((p) => (p.id === id ? { ...p, active: !p.active } : p)))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health Programs"
        description="Manage clinic health programs and campaigns."
      >
        <Button size="sm" onClick={() => { setEditingId(null); setForm({ name: "", description: "", target_group: "", active: true }); setShowForm(true) }} className="cursor-pointer">
          <Plus className="size-3.5 mr-1" /> New Program
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HeartPulse className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No health programs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((p) => (
            <Card key={p.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{p.name}</CardTitle>
                  <input
                    type="checkbox"
                    checked={p.active}
                    onChange={() => toggleActive(p.id)}
                    title={p.active ? "Active" : "Inactive"}
                    className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-zinc-500 leading-relaxed">{p.description}</p>
                <div className="flex flex-wrap gap-1">
                  {p.target_group.map((tg) => (
                    <span key={tg} className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-50 text-zinc-600 border border-zinc-200 capitalize">
                      {tg}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-zinc-100">
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setEditingId(p.id); setForm({ name: p.name, description: p.description, target_group: p.target_group.join(", "), active: p.active }); setShowForm(true) }}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(p.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="shadow-lg w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="text-base">{editingId ? "Edit Program" : "New Program"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Program Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Target Group (comma-separated)</label>
                <input value={form.target_group} onChange={(e) => setForm({ ...form, target_group: e.target.value })} placeholder="students, faculty" className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer" />
                <label htmlFor="active" className="text-xs font-medium cursor-pointer">Active</label>
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Create Program"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}