"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, UserPlus, Check } from "lucide-react"
import { toast } from "sonner"
import { registerStudentProfile, createStudentAccount } from "@/actions/admin/rfid-registration"
import { createFacultyAccountAction } from "@/actions/admin/faculty-accounts"
import { PasswordStrengthInput } from "@/components/password-strength-input"
import { checkPassword } from "@/lib/validation/password"

export default function AdminAddRecordPage() {
  const [role, setRole] = useState<"student" | "faculty">("student")
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    course: "",
    yearLevel: "",
    position: "",
    studentNumber: "",
    employeeNumber: "",
    rfidUid: "",
  })
  const [accountEmail, setAccountEmail] = useState("")
  const [accountPassword, setAccountPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required")
      return
    }
    if (role === "student" && !form.studentNumber.trim()) {
      toast.error("Student number is required")
      return
    }
    if (role === "faculty" && !form.employeeNumber.trim()) {
      toast.error("Employee number is required")
      return
    }

    setSubmitting(true)
    try {
      if (role === "student") {
        const fd = new FormData()
        fd.set("rfidUid", form.rfidUid || `TEMP-${Date.now()}`)
        fd.set("firstName", form.firstName)
        fd.set("lastName", form.lastName)
        fd.set("email", form.email || "")
        fd.set("department", form.department || "")
        fd.set("course", form.course || "")
        fd.set("yearLevel", form.yearLevel || "")
        fd.set("position", "")
        fd.set("studentNumber", form.studentNumber)
        fd.set("employeeNumber", "")
        fd.set("clinicPhotoUrl", "")
        fd.set("role", "student")

        const res = await registerStudentProfile(fd)
        if (res.error) {
          toast.error(res.error)
          return
        }
        if (res.data?.id && accountEmail && accountPassword) {
          const pwCheck = checkPassword(accountPassword)
          if (!pwCheck.valid) {
            toast.error(`Password needs: ${pwCheck.missing.join(", ")}`)
            return
          }
          const accFd = new FormData()
          accFd.set("email", accountEmail)
          accFd.set("password", accountPassword)
          accFd.set("studentAccountId", res.data.id)
          const accRes = await createStudentAccount(accFd)
          if (accRes.error) {
            toast.error(accRes.error)
            return
          }
        }
      } else {
        const fd = new FormData()
        fd.set("firstName", form.firstName)
        fd.set("lastName", form.lastName)
        fd.set("email", form.email || "")
        fd.set("employeeNumber", form.employeeNumber)
        fd.set("department", form.department || "")
        fd.set("position", form.position || "")
        fd.set("phone", "")
        fd.set("rfidUid", form.rfidUid || "")
        fd.set("password", accountPassword || "TemporaryPass123!")

        const res = await createFacultyAccountAction(fd)
        if (res.error) {
          toast.error(res.error)
          return
        }
      }

      toast.success("Record created successfully")
      setCreated(true)
      setForm({ firstName: "", lastName: "", email: "", department: "", course: "", yearLevel: "", position: "", studentNumber: "", employeeNumber: "", rfidUid: "" })
      setAccountEmail("")
      setAccountPassword("")
    } catch (err: any) {
      toast.error(err.message || "Failed to create record")
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <PageHeader title="Add Record" description="Create a new patient record." />
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <div className="mx-auto size-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="size-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Record Created!</h3>
              <p className="text-sm text-muted-foreground mt-1">The patient record has been added successfully.</p>
            </div>
            <Button onClick={() => setCreated(false)} className="cursor-pointer">
              <UserPlus className="size-3.5 mr-1" /> Add Another
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Add Record"
        description="Create a new student or faculty patient record."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Patient Information</CardTitle>
          <CardDescription className="text-xs">Fill in the patient's basic information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Record Type</Label>
              <div className="flex rounded-lg border border-zinc-200 overflow-hidden w-fit">
                {(["student", "faculty"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors capitalize ${
                      role === r ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name <span className="text-red-500">*</span></Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-9" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name <span className="text-red-500">*</span></Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-9" required />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {role === "student" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Student Number <span className="text-red-500">*</span></Label>
                  <Input value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} placeholder="23011XXXX" className="h-9 font-mono" required />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Employee Number <span className="text-red-500">*</span></Label>
                  <Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} placeholder="EMP-0001" className="h-9 font-mono" required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@school.edu" className="h-9" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
                >
                  <option value="">Select Department</option>
                  <option value="College of Engineering">College of Engineering</option>
                  <option value="College of Computer Studies">College of Computer Studies</option>
                  <option value="College of Nursing">College of Nursing</option>
                  <option value="College of Arts and Sciences">College of Arts and Sciences</option>
                  <option value="College of Business">College of Business</option>
                </select>
              </div>
              {role === "student" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Course</Label>
                  <select
                    value={form.course}
                    onChange={(e) => setForm({ ...form, course: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
                  >
                    <option value="">Select Course</option>
                    <option value="BS Information Technology">BS Information Technology</option>
                    <option value="BS Computer Science">BS Computer Science</option>
                    <option value="BS Nursing">BS Nursing</option>
                    <option value="BS Psychology">BS Psychology</option>
                    <option value="BS Business Administration">BS Business Administration</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Position</Label>
                  <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Lab Technician" className="h-9" />
                </div>
              )}
            </div>

            {role === "student" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Year Level</Label>
                <select
                  value={form.yearLevel}
                  onChange={(e) => setForm({ ...form, yearLevel: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="1">1st</option>
                  <option value="2">2nd</option>
                  <option value="3">3rd</option>
                  <option value="4">4th</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">RFID UID (Optional)</Label>
              <Input value={form.rfidUid} onChange={(e) => setForm({ ...form, rfidUid: e.target.value })} placeholder="Scan card or enter UID" className="h-9 font-mono" />
            </div>

            <div className="border-t border-zinc-100 pt-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500">Portal Account (Optional)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Login Email</Label>
                  <Input type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="login@school.edu" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Temporary Password</Label>
                  <PasswordStrengthInput
                    value={accountPassword}
                    onChange={setAccountPassword}
                    placeholder="Create a temporary password"
                    showChecklist={false}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="cursor-pointer">
              {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Creating...</> : <><UserPlus className="size-3.5 mr-1" /> Create Record</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}