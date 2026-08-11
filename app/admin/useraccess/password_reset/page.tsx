"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  resetPortalPasswordAction,
  searchRecoveryAccountsAction,
  type RecoveryAccountRole,
  type RecoveryAccountSearchResult,
} from "@/actions/admin/accounts/patient-portal";
import { PageHeader } from "@/components/common/page-header";
import { PasswordStrengthInput } from "@/components/common/password-strength-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkPassword } from "@/lib/validation/password";
import { cn } from "@/lib/utils";

const roleLabels: Record<RecoveryAccountRole, string> = {
  doctor: "Doctor",
  faculty: "Faculty",
  nurse: "Nurse",
  staff: "Staff (non-clinic)",
  student: "Student",
};

// Provides searchable, audited credential recovery for patient and clinician portals.
export default function PasswordResetPage() {
  const [role, setRole] = useState<RecoveryAccountRole>("student");
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<RecoveryAccountSearchResult[]>([]);
  const [selectedAccount, setSelectedAccount] =
    useState<RecoveryAccountSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchRecoveryAccountsAction({
          query: trimmedQuery,
          role,
        });
        if (cancelled) return;
        setAccounts(result.accounts);
        setSearchError(result.error ?? null);
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setSearchError("Unable to search accounts right now.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, role]);

  // Selects one eligible search result as the reset target.
  function selectAccount(account: RecoveryAccountSearchResult) {
    if (!account.canReset) return;
    setSelectedAccount(account);
    setSearchError(null);
  }

  // Clears stale account state when the recovery role changes.
  function changeRole(nextRole: RecoveryAccountRole) {
    setRole(nextRole);
    setQuery("");
    setAccounts([]);
    setSelectedAccount(null);
    setSearchError(null);
  }

  // Clears a selection when the administrator starts a different search.
  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setAccounts([]);
    setSelectedAccount(null);
    setSearching(false);
    setSearchError(null);
  }

  // Validates the password before invoking the protected server reset action.
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount?.canReset) {
      toast.error("Select an active account first.");
      return;
    }

    const passwordCheck = checkPassword(password);
    if (!passwordCheck.valid) {
      toast.error(`Password needs: ${passwordCheck.missing.join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      const result = await resetPortalPasswordAction({
        newPassword: password,
        role: selectedAccount.role,
        targetId: selectedAccount.targetId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Password reset for ${result.maskedEmail ?? "the selected account"}. Existing sessions were revoked.`,
      );
      setQuery("");
      setAccounts([]);
      setSelectedAccount(null);
      setPassword("");
    } catch {
      toast.error("Unable to reset the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Password Recovery"
        description="Find a portal user by role, then securely reset their password and revoke prior sessions."
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> Secure password reset
          </CardTitle>
          <CardDescription>
            Search by name, login email, student number, or employee number.
            Clinic Admin accounts are intentionally excluded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="recovery-role">Account role</Label>
              <select
                id="recovery-role"
                value={role}
                onChange={(event) =>
                  changeRole(event.target.value as RecoveryAccountRole)
                }
                disabled={saving}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="staff">Staff (non-clinic)</option>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-search">
                Search {roleLabels[role]} accounts
              </Label>
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="account-search"
                  value={query}
                  onChange={(event) => changeQuery(event.target.value)}
                  placeholder="Enter at least two characters"
                  autoComplete="off"
                  disabled={saving}
                  className="pr-10 pl-9"
                  aria-describedby="account-search-status"
                  aria-controls="account-search-results"
                />
                {searching ? (
                  <Loader2
                    aria-label="Searching accounts"
                    className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                  />
                ) : null}
              </div>
              <p
                id="account-search-status"
                className={cn(
                  "text-xs text-muted-foreground",
                  searchError && "text-destructive",
                )}
                aria-live="polite"
              >
                {searchError ??
                  (query.trim().length < 2
                    ? "Search results appear after two characters."
                    : searching
                      ? "Searching..."
                      : `${accounts.length} matching account${accounts.length === 1 ? "" : "s"}.`)}
              </p>
            </div>

            {query.trim().length >= 2 && !searching && !searchError ? (
              <div
                id="account-search-results"
                className="max-h-72 overflow-y-auto rounded-lg border border-border p-1"
                role="listbox"
                aria-label={`${roleLabels[role]} search results`}
              >
                {accounts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No role-matched accounts found.
                  </div>
                ) : (
                  accounts.map((account) => (
                    <button
                      key={`${account.role}:${account.targetId}`}
                      type="button"
                      role="option"
                      aria-selected={
                        selectedAccount?.targetId === account.targetId
                      }
                      disabled={!account.canReset || saving}
                      onClick={() => selectAccount(account)}
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
                        selectedAccount?.targetId === account.targetId &&
                          "bg-primary/10 ring-1 ring-primary/30",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <UserRound className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {account.displayName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[
                            account.identifier,
                            account.department,
                            account.maskedEmail,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No additional profile details"}
                        </span>
                      </span>
                      <Badge variant="outline" className="capitalize">
                        {account.status}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {selectedAccount ? (
              <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium">{selectedAccount.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {roleLabels[selectedAccount.role]}
                    {selectedAccount.identifier
                      ? ` · ${selectedAccount.identifier}`
                      : ""}
                    {selectedAccount.maskedEmail
                      ? ` · ${selectedAccount.maskedEmail}`
                      : ""}
                  </p>
                </div>
              </div>
            ) : null}

            <PasswordStrengthInput
              id="new-password"
              label="New temporary password"
              value={password}
              onChange={setPassword}
              placeholder="Create a strong temporary password"
              disabled={saving || !selectedAccount?.canReset}
            />
            <Button
              type="submit"
              disabled={saving || !selectedAccount?.canReset}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Resetting...
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
