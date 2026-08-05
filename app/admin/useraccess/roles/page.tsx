"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Shield } from "lucide-react"
import { toast } from "sonner"
import { getSettingsAction, updateSettingAction } from "@/actions/admin/settings"

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", description: "", permissions: "" })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSettingsAction()
      if (res.error) {
        toast.error(res.error)
        return
      }
      const existing = res.settings.find((s) => s.key === "user_roles")
      if (existing?.value && Array.isArray(existing.value.roles)) {
        setRoles(existing.value.roles as Role[])
      } else {
        setRoles([
          { id: "admin", name: "Admin", description: "Full system access", permissions: ["all"] },
          { id: "doctor", name: "Doctor", description: "Medical consultations and prescriptions", permissions: ["consultations", "prescriptions", "records"] },
          { id: "nurse", name: "Nurse", description: "Triage and vital signs", permissions: ["triage", "vitals"] },
          { id: "staff", name: "Staff", description: "Limited access", permissions: ["appointments", "records"] },
        ])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load roles")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveRoles = async (next: Role[]) => {
    setSaving(true)
    try {
      const res = await updateSettingAction({ key: "user_roles", value: { roles: next } })
      if (res.error) {
        toast.error(res.error)
      } else {
        setRoles(next)
        toast.success("Roles saved")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Role name is required")
      return
    }
    const permissions = form.permissions.split(",").map((s) => s.trim()).filter(Boolean)
    if (editingId) {
      await saveRoles(roles.map((r) =>
        r.id === editingId ? { ...r, name: form.name.trim(), description: form.description.trim(), permissions } : r
      ))
    } else {
      await saveRoles([
        ...roles,
        { id: `role-${Date.now()}`, name: form.name.trim(), description: form.description.trim(), permissions },
      ])
    }
    setShowForm(false)
    setForm({ name: "", description: "", permissions: "" })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this role?")) return
    await saveRoles(roles.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Roles & Permissions"
        description="Manage access roles and their permissions."
      >
        <Button size="sm" onClick={() => { setEditingId(null); setForm({ name: "", description: "", permissions: "" }); setShowForm(true) }} className="cursor-pointer">
          New Role
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <Card key={r.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-zinc-100 flex items-center justify-center">
                    <Shield className="size-4 text-zinc-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{r.name}</CardTitle>
                    <CardDescription className="text-xs">{r.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-50 text-zinc-600 border border-zinc-200">
                      {p}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-zinc-100">
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setEditingId(r.id); setForm({ name: r.name, description: r.description, permissions: r.permissions.join(", ") }); setShowForm(true) }}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(r.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Simple modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="shadow-lg w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="text-base">{editingId ? "Edit Role" : "New Role"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Role Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Permissions (comma-separated)</label>
                <input value={form.permissions} onChange={(e) => setForm({ ...form, permissions: e.target.value })} placeholder="consultations, prescriptions, records" className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none" />
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Create Role"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}