"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Plus, Shield, Trash2, Pencil, KeyRound } from "lucide-react"
import {
  getRolesAction,
  getPermissionsAction,
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
  assignPermissionAction,
  removePermissionAction,
  type RoleWithPermissionsDTO,
  type PermissionDTO,
} from "./actions"

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleWithPermissionsDTO[]>([])
  const [permissions, setPermissions] = useState<PermissionDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleWithPermissionsDTO | null>(null)
  const [permissionRole, setPermissionRole] = useState<RoleWithPermissionsDTO | null>(null)
  const [roleForm, setRoleForm] = useState({ name: "", description: "" })

  async function fetchData() {
    setLoading(true)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        getRolesAction(),
        getPermissionsAction(),
      ])
      if (rolesRes.error) toast.error(rolesRes.error)
      else setRoles(rolesRes.roles)
      if (permsRes.error) toast.error(permsRes.error)
      else setPermissions(permsRes.permissions)
    } catch (err: any) {
      toast.error(err?.message || "Failed to load roles")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleCreateRole() {
    if (!roleForm.name.trim()) {
      toast.error("Role name is required")
      return
    }
    const res = await createRoleAction({ name: roleForm.name, description: roleForm.description })
    if (res.error) toast.error(res.error)
    else {
      toast.success("Role created")
      setShowCreate(false)
      setRoleForm({ name: "", description: "" })
      fetchData()
    }
  }

  async function handleUpdateRole() {
    if (!editingRole) return
    if (!roleForm.name.trim()) {
      toast.error("Role name is required")
      return
    }
    const res = await updateRoleAction({ id: editingRole.id, name: roleForm.name, description: roleForm.description })
    if (res.error) toast.error(res.error)
    else {
      toast.success("Role updated")
      setEditingRole(null)
      setRoleForm({ name: "", description: "" })
      fetchData()
    }
  }

  async function handleDeleteRole(id: string) {
    if (!confirm("Delete this role? This cannot be undone.")) return
    const res = await deleteRoleAction(id)
    if (res.error) toast.error(res.error)
    else {
      toast.success("Role deleted")
      fetchData()
    }
  }

  async function handleTogglePermission(permissionId: string, isAssigned: boolean) {
    if (!permissionRole) return
    const res = isAssigned
      ? await removePermissionAction({ roleId: permissionRole.id, permissionId })
      : await assignPermissionAction({ roleId: permissionRole.id, permissionId })
    if (res.error) toast.error(res.error)
    else {
      toast.success(isAssigned ? "Permission removed" : "Permission assigned")
      fetchData()
      const fresh = await getRolesAction()
      if (fresh.roles) {
        const updated = fresh.roles.find((r) => r.id === permissionRole.id)
        if (updated) setPermissionRole(updated)
      }
    }
  }

  const permissionGroups = permissions.reduce<Record<string, PermissionDTO[]>>((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = []
    acc[p.resource].push(p)
    return acc
  }, {})

  const rolePermissionIds = permissionRole?.permissions.map((p) => p.id) || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Management"
        description="Create, edit, and assign permissions to system roles."
      />

      <div className="flex justify-end">
        <Button onClick={() => { setShowCreate(true); setRoleForm({ name: "", description: "" }) }} className="cursor-pointer">
          <Plus className="size-4 mr-1" /> Create Role
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : roles.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No roles found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="size-4 text-zinc-400" />
                        <span className="capitalize">{role.name}</span>
                        {!role.is_deletable && (
                          <Badge variant="outline" className="text-[10px]">Protected</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[250px] truncate">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 4).map((p) => (
                          <Badge key={p.id} variant="secondary" className="text-[10px]">
                            {p.name}
                          </Badge>
                        ))}
                        {role.permissions.length > 4 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{role.permissions.length - 4} more
                          </Badge>
                        )}
                        {role.permissions.length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Assign Permissions"
                          onClick={() => setPermissionRole(role)}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Edit Role"
                          onClick={() => {
                            setEditingRole(role)
                            setRoleForm({ name: role.name, description: role.description || "" })
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {role.is_deletable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            title="Delete Role"
                            onClick={() => handleDeleteRole(role.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Role Name</Label>
              <Input
                value={roleForm.name}
                onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. receptionist"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                value={roleForm.description}
                onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this role do?"
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreateRole}>Create Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Role Name</Label>
              <Input
                value={roleForm.name}
                onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                value={roleForm.description}
                onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
            <Button onClick={handleUpdateRole}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Assignment Dialog */}
      <Dialog open={!!permissionRole} onOpenChange={() => setPermissionRole(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Permissions — <span className="capitalize">{permissionRole?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {Object.entries(permissionGroups).map(([resource, perms]) => (
              <div key={resource} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {resource.replace(/_/g, " ")}
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {perms.map((p) => {
                    const isAssigned = rolePermissionIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleTogglePermission(p.id, isAssigned)}
                        className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${isAssigned
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white border-zinc-200 hover:bg-zinc-50"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className={`text-xs truncate ${isAssigned ? "text-zinc-300" : "text-zinc-400"}`}>
                              {p.action} · {p.resource}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] ${isAssigned ? "border-zinc-500 text-zinc-300" : "text-zinc-400"}`}
                          >
                            {isAssigned ? "Assigned" : "Available"}
                          </Badge>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionRole(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}