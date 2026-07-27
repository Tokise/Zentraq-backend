"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"
import { createOperator, removeOperator } from "@/app/(dashboard)/admin/operators/actions"
import { toast } from "sonner"
import {
  Loader2,
  Shield,
  Trash2,
  UserPlus,
  Check,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"

type StaffRole = "admin" | "nurse" | "doctor"

interface StaffAccount {
  id: string
  user_id?: string
  email: string
  role: StaffRole
  full_name: string | null
  created_at: string
}

const STEPS = ["Role", "Account Details", "Review"]

export default function OperatorsPage() {
  const supabase = createClient()
  const [operators, setOperators] = useState<StaffAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ email: "", password: "", fullName: "", role: "nurse" as StaffRole })

  async function fetchOperators() {
    setLoading(true)
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      toast.error(error.message)
    } else {
      setOperators((data as unknown as StaffAccount[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchOperators()
  }, [])

  function resetForm() {
    setForm({ email: "", password: "", fullName: "", role: "nurse" })
    setStep(1)
    setShowWizard(false)
  }

  async function handleCreate() {
    if (!form.email || !form.password || !form.fullName) {
      toast.error("Please fill in all fields")
      return
    }

    setCreating(true)
    const formData = new FormData()
    formData.set("email", form.email)
    formData.set("password", form.password)
    formData.set("fullName", form.fullName)
    formData.set("role", form.role)

    const result = await createOperator(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Account created successfully")
      resetForm()
      await fetchOperators()
    }

    setCreating(false)
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remove this account?")) return

    const result = await removeOperator(userId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Account removed")
      await fetchOperators()
    }
  }

  const roleBadge = (role: StaffRole) => {
    const colors: Record<StaffRole, string> = {
      admin: "bg-red-50 text-red-700 border-red-200",
      nurse: "bg-blue-50 text-blue-700 border-blue-200",
      doctor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    }
    return (
      <Badge variant="outline" className={`capitalize text-[10px] ${colors[role] || ""}`}>
        {role === "admin" && <Shield className="size-3 mr-1" />}
        {role}
      </Badge>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Clinic Accounts"
        description="Create and manage dashboard login accounts for clinic staff."
      >
        <Button
          size="sm"
          onClick={() => setShowWizard(!showWizard)}
          className="cursor-pointer"
        >
          {showWizard ? "Cancel" : <><UserPlus className="size-3.5 mr-1" /> Add Account</>}
        </Button>
      </PageHeader>

      {/* Creation Wizard */}
      {showWizard && (
        <Card className="shadow-sm border-zinc-200/80 max-w-lg mx-auto">
          <CardContent className="p-6">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-0 mb-6">
              {STEPS.map((label, i) => {
                const stepNum = i + 1
                const isActive = step === stepNum
                const isDone = step > stepNum
                return (
                  <div key={label} className="flex items-center">
                    {i > 0 && (
                      <div className={`w-8 h-px mx-1 ${isDone ? "bg-zinc-400" : "bg-zinc-200"}`} />
                    )}
                    <div className="flex flex-col items-center gap-0.5">
                      <div
                        className={`size-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${isDone
                            ? "bg-zinc-800 text-white"
                            : isActive
                              ? "bg-zinc-900 text-white"
                              : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                          }`}
                      >
                        {isDone ? <Check className="size-3" /> : stepNum}
                      </div>
                      <span className={`text-[9px] ${isActive || isDone ? "text-zinc-600 font-medium" : "text-zinc-300"}`}>
                        {label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-semibold">Select Role</h3>
                  <p className="text-xs text-zinc-400">Choose the account type for this staff member</p>
                </div>
                <div className="grid gap-3">
                  {[
                    { value: "nurse" as StaffRole, label: "Nurse", desc: "Can manage consultations, patients, and pharmacy" },
                    { value: "doctor" as StaffRole, label: "Doctor", desc: "Full clinical access including medical records" },
                    { value: "admin" as StaffRole, label: "Admin", desc: "Full system access including administration" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role: option.value }))}
                      className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${form.role === option.value
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                        }`}
                    >
                      <p className="text-sm font-medium capitalize">{option.label}</p>
                      <p className={`text-xs mt-0.5 ${form.role === option.value ? "text-zinc-300" : "text-zinc-400"}`}>
                        {option.desc}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => setStep(2)}
                    className="bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer flex items-center gap-1"
                  >
                    Next <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-semibold">Account Details</h3>
                  <p className="text-xs text-zinc-400">
                    Setting up a <span className="font-semibold capitalize">{form.role}</span> account
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Full Name</Label>
                    <Input
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      placeholder="e.g. Jane Doe"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@school.edu"
                      required
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Temporary Password</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      required
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="size-3.5" /> Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStep(3)}
                    className="bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer flex items-center gap-1"
                  >
                    Review <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-semibold">Review</h3>
                  <p className="text-xs text-zinc-400">Confirm the account details before creating</p>
                </div>
                <div className="border border-zinc-200/80 rounded-lg p-4 bg-zinc-50/50 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Role</span>
                    <Badge variant="outline" className="capitalize text-[10px]">{form.role}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Name</span>
                    <span className="font-medium text-zinc-700">{form.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Email</span>
                    <span className="font-medium text-zinc-700">{form.email}</span>
                  </div>
                </div>
                <div className="flex gap-2 justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="size-3.5" /> Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreate}
                    disabled={creating}
                    className="bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer min-w-[140px]"
                  >
                    {creating ? (
                      <><RefreshCw className="size-3.5 animate-spin mr-1" /> Creating...</>
                    ) : (
                      <><Check className="size-3.5 mr-1" /> Create Account</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Accounts Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : operators.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No staff accounts yet. Click "Add Account" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((account) => {
                  const accountId = account.id || account.user_id || ""
                  return (
                    <TableRow key={accountId}>
                      <TableCell className="font-medium">{account.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{account.email}</TableCell>
                      <TableCell>{roleBadge(account.role as StaffRole)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {account.created_at
                          ? format(new Date(account.created_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {account.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive cursor-pointer"
                            onClick={() => handleRemove(accountId)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}