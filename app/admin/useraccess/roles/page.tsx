"use client";

import { useEffect, useState } from "react";
import { Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  createRoleAction,
  getRolesAction,
  type RoleWithPermissionsDTO,
} from "@/actions/access/roles";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Displays roles and the permissions currently assigned from the RBAC tables.
export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleWithPermissionsDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Loads authoritative role and permission assignments for the cards.
  async function loadRoles() {
    setLoading(true);
    try {
      const result = await getRolesAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setRoles(result.roles);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadRoles);
  }, []);

  // Creates a role without allowing role details to be edited on this screen.
  async function createRole() {
    if (!name.trim()) {
      toast.error("A role name is required");
      return;
    }
    setSaving(true);
    try {
      const result = await createRoleAction({ name, description });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Role created. Configure its permissions next.");
      setName("");
      setDescription("");
      setShowCreateDialog(false);
      await loadRoles();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Create roles and review their assigned permissions."
      >
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="cursor-pointer"
        >
          <Plus className="size-4" /> New Role
        </Button>
      </PageHeader>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading roles…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                    <Shield className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="capitalize">{role.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {role.description || "No description provided."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No permissions assigned
                    </span>
                  ) : (
                    role.permissions.map((permission) => (
                      <Badge
                        key={permission.id}
                        variant="outline"
                        className="font-normal"
                      >
                        {permission.name}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Permissions are managed from the Permissions page.
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Pharmacist"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Brief access description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={createRole} disabled={saving}>
              {saving ? "Creating…" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
