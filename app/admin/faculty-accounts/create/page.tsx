"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createFacultyAccountAction } from "../actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { UserPlus, Mail, Phone, Building2 } from "lucide-react"

export default function AdminFacultyCreatePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    department: "",
    position: "",
    phone: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("firstName", form.first_name)
      formData.set("lastName", form.last_name)
      formData.set("email", form.email)
      formData.set("password", form.password)
      formData.set("employeeNumber", `EMP-${Date.now()}`)
      formData.set("department", form.department)
      formData.set("position", form.position)
      formData.set("phone", form.phone)
      const result = await createFacultyAccountAction(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Faculty account created successfully")
        router.push("/admin/faculty-accounts")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create account")
    } finally {
      setSubmitting(false)
    }
  }

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Create Faculty Account"
        description="Register a new faculty member in the system."
      />

      <Card className="border-zinc-200/80 shadow-sm bg-white">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input value={form.first_name} onChange={update("first_name")} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input value={form.last_name} onChange={update("last_name")} required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input type="email" value={form.email} onChange={update("email")} required className="pl-8" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input type="password" value={form.password} onChange={update("password")} required minLength={6} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <div className="relative">
                <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input value={form.department} onChange={update("department")} className="pl-8" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Position</label>
              <Input value={form.position} onChange={update("position")} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input value={form.phone} onChange={update("phone")} className="pl-8" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                <UserPlus className="size-4 mr-2" />
                {submitting ? "Creating..." : "Create Account"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}