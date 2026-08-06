"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  assignPermissionAction,
  getPermissionsAction,
  getRolesAction,
  removePermissionAction,
  type PermissionDTO,
  type RoleWithPermissionsDTO,
} from "@/actions/admin/useraccess/roles";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Renders the persisted permission matrix for every role in the RBAC database.
export default function AdminPermissionsPage() {
  const [roles, setRoles] = useState<RoleWithPermissionsDTO[]>([]);
  const [permissions, setPermissions] = useState<PermissionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Loads roles and permission definitions from the same source as the Roles page.
  async function loadMatrix() {
    setLoading(true);
    try {
      const [rolesResult, permissionsResult] = await Promise.all([
        getRolesAction(),
        getPermissionsAction(),
      ]);
      if (rolesResult.error || permissionsResult.error) {
        toast.error(
          rolesResult.error ??
            permissionsResult.error ??
            "Failed to load permissions",
        );
        return;
      }
      setRoles(rolesResult.roles);
      setPermissions(permissionsResult.permissions);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadMatrix);
  }, []);

  const permissionAssignments = useMemo(() => {
    return new Set(
      roles.flatMap((role) =>
        role.permissions.map((permission) => `${role.id}:${permission.id}`),
      ),
    );
  }, [roles]);

  // Persists a single role-permission toggle and updates the matrix optimistically.
  async function togglePermission(
    role: RoleWithPermissionsDTO,
    permission: PermissionDTO,
  ) {
    const key = `${role.id}:${permission.id}`;
    const isAssigned = permissionAssignments.has(key);
    setUpdating(key);
    try {
      const result = isAssigned
        ? await removePermissionAction({
            roleId: role.id,
            permissionId: permission.id,
          })
        : await assignPermissionAction({
            roleId: role.id,
            permissionId: permission.id,
          });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setRoles((current) =>
        current.map((currentRole) => {
          if (currentRole.id !== role.id) return currentRole;
          return {
            ...currentRole,
            permissions: isAssigned
              ? currentRole.permissions.filter(
                  (item) => item.id !== permission.id,
                )
              : [...currentRole.permissions, permission],
          };
        }),
      );
      toast.success(
        `${permission.name} ${isAssigned ? "removed from" : "assigned to"} ${role.name}`,
      );
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissions"
        description="Select a permission to assign or remove it. Changes appear immediately on Roles."
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 || permissions.length === 0 ? (
        <EmptyState
          title="Permission matrix unavailable"
          description="Create at least one role and ensure permissions are seeded in the database."
          icon={ShieldCheck}
        />
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">Permission Matrix</CardTitle>
            <CardDescription>
              Each checkbox is saved immediately and audited.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">
                      Permission
                    </th>
                    {roles.map((role) => (
                      <th
                        key={role.id}
                        className="px-4 py-3 text-center font-medium capitalize"
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {permissions.map((permission) => (
                    <tr
                      key={permission.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium">{permission.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {permission.description ||
                            `${permission.resource} · ${permission.action}`}
                        </p>
                      </td>
                      {roles.map((role) => {
                        const key = `${role.id}:${permission.id}`;
                        const isAssigned = permissionAssignments.has(key);
                        return (
                          <td key={role.id} className="px-4 py-3 text-center">
                            <label className="inline-flex cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                disabled={updating === key}
                                onChange={() =>
                                  togglePermission(role, permission)
                                }
                                className="size-4 cursor-pointer rounded border-border accent-primary disabled:cursor-wait"
                              />
                              <span className="sr-only">
                                Toggle {permission.name} for {role.name}
                              </span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <Badge variant="outline">Live</Badge> Assignments are stored in
              role_permissions.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
