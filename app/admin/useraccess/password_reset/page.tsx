"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resetStudentPassword } from "@/actions/admin/rfid/registration";
import { resetFacultyPasswordAction } from "@/actions/admin/accounts/faculty";
import { PageHeader } from "@/components/common/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Provides an audited password-reset form for existing student and faculty accounts.
export default function PasswordResetPage() {
  const [accountType, setAccountType] = useState<"student" | "faculty">(
      "student",
    ),
    [profileId, setProfileId] = useState(""),
    [password, setPassword] = useState(""),
    [saving, setSaving] = useState(false);
  // Validates the selected profile type and delegates the reset to its server action.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.set(
        accountType === "student" ? "studentAccountId" : "facultyId",
        profileId,
      );
      form.set("newPassword", password);
      const result =
        accountType === "student"
          ? await resetStudentPassword(form)
          : await resetFacultyPasswordAction(form);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          `Password reset for ${result.email ?? "account"}. Existing sessions were revoked.`,
        );
        setProfileId("");
        setPassword("");
      }
    } catch {
      toast.error("Unable to reset the password");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Password Reset"
        description="Reset a portal password and revoke active sessions for a student or faculty account."
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> Secure password reset
          </CardTitle>
          <CardDescription>
            Use the profile ID from the account record. New passwords must
            contain at least 12 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="account-type">Account type</Label>
              <select
                id="account-type"
                value={accountType}
                onChange={(event) =>
                  setAccountType(event.target.value as "student" | "faculty")
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty / Staff</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-id">Profile ID</Label>
              <Input
                id="profile-id"
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
                placeholder="Account profile UUID"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New temporary password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                placeholder="At least 12 characters"
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Resetting…
                </>
              ) : (
                "Reset password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
