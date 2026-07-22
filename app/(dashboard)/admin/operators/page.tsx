"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"
import { createOperator, removeOperator } from "@/app/(dashboard)/admin/operators/actions"
import { toast } from "sonner"
import { Loader2, Shield, Trash2, UserPlus } from "lucide-react"

interface StaffAccount {
  id: string
  user_id?: string
  email: string
  role: string
  full_name: string | null
  created_at: string
}

export default function OperatorsPage() {
  const supabase = createClient()
  const [operators, setOperators] = useState<StaffAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ email: "", password: "", fullName: "" })

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)

    const formData = new FormData()
    formData.set("email", form.email)
    formData.set("password", form.password)
    formData.set("fullName", form.fullName)

    const result = await createOperator(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Operator account created")
      setForm({ email: "", password: "", fullName: "" })
      await fetchOperators()
    }

    setCreating(false)
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remove this operator account?")) return

    const result = await removeOperator(userId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Operator removed")
      await fetchOperators()
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Operator Accounts"
        description="Create and manage dashboard login accounts for clinic operators."
      />

      <Card className="shadow-sm">
        <CardContent className="p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="size-4" />
              Add Operator
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Jane Operator"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="operator@school.edu"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="password">Temporary Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Create Operator
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : operators.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No staff accounts yet. Seed your first admin in Supabase, then add operators here.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {operators.map((account) => {
                const accountId = account.id || account.user_id || ""
                return (
                  <div key={accountId} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{account.full_name || account.email}</p>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {account.role === "admin" ? (
                            <span className="inline-flex items-center gap-1">
                              <Shield className="size-3" /> admin
                            </span>
                          ) : (
                            account.role
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{account.email}</p>
                    </div>
                    {account.role !== "admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(accountId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
