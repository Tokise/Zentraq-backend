"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { getSettingsAction, updateSettingAction } from "@/actions/admin/settings"

interface Permission {
  key: string
  description: string
  roles: Record<string, boolean>
}

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSettingsAction()
      if (res.error) {
        toast.error(res.error)
        return
      }
      const rolesSetting = res.settings.find((s) => s.key === "user_roles")
      const permissionsSetting = res.settings.find((s) => s.key === "permissions")

      let roleNames: string[] = []
      if (rolesSetting?.value?.roles && Array.isArray(rolesSetting.value.roles)) {
        roleNames = rolesSetting.value.roles.map((r: any) => r.id)
      } else {
        roleNames = ["admin", "doctor", "nurse", "staff"]
      }

      const defaultPermissions: Permission[] = [
        { key: "view_dashboard", description: "View dashboard", roles: {} },
        { key: "manage_consultations", description: "Manage consultations", roles: {} },
        { key: "manage_prescriptions", description: "Manage prescriptions", roles: {} },
        { key: "manage_appointments", description: "Manage appointments", roles: {} },
        { key: "manage_inventory", description: "Manage medicine inventory", roles: {} },
        { key: "view_records", description: "View medical records", roles: {} },
        { key: "edit_records", description: "Edit medical records", roles: {} },
        { key: "manage_incidents", description: "Manage incidents", roles: {} },
        { key: "manage_clearances", description: "Manage clearances", roles: {} },
        { key: "view_reports", description: "View reports", roles: {} },
      ]

      if (permissionsSetting?.value?.permissions && Array.isArray(permissionsSetting.value.permissions)) {
        setPermissions(permissionsSetting.value.permissions as Permission[])
      } else {
        setPermissions(defaultPermissions)
      }
      setRoles(roleNames)
    } catch (err: any) {
      toast.error(err.message || "Failed to load permissions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const togglePermission = (permIndex: number, role: string) => {
    setPermissions((prev) =>
      prev.map((p, i) =>
        i === permIndex
          ? { ...p, roles: { ...p.roles, [role]: !p.roles[role] } }
          : p
      )
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateSettingAction({ key: "permissions", value: { permissions } })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Permissions saved")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissions"
        description="Fine-grained permission control by role."
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Permission Matrix</CardTitle>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-left">Permission</th>
                    {roles.map((role) => (
                      <th key={role} className="px-4 py-3 font-medium text-center capitalize min-w-[100px]">{role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {permissions.map((perm, i) => (
                    <tr key={perm.key} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm">{perm.description}</td>
                      {roles.map((role) => (
                        <td key={role} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!perm.roles[role]}
                            onChange={() => togglePermission(i, role)}
                            className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}