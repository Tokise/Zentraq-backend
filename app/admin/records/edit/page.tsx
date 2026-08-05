"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, User, Pencil } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/admin/records"
import { saveStudentProfileEdit } from "@/actions/admin/student-accounts"
import { updateFacultyAccountAction } from "@/actions/admin/faculty-accounts"

export default function AdminEditRecordPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Record<string, any> | null>(null)
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
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await searchRecordsAction(query)
      if (res.error) {
        toast.error(res.error)
        setResults([])
      } else {
        setResults([...res.students, ...res.faculty])
      }
    } finally {
      setSearching(false)
    }
  }

  function selectPatient(r: Record<string, any>) {
    setSelected(r)
    setResults([])
    setQuery("")
    setForm({
      firstName: r.first_name || "",
      lastName: r.last_name || "",
      email: r.email || "",
      department: r.department || "",
      course: r.course || "",
      yearLevel: r.year_level ? String(r.year_level) : "",
      position: r.position || "",
      studentNumber: r.student_number || "",
      employeeNumber: r.employee_number || "",
    })
  }

  function isStudent() {
    return selected && "student_number" in selected
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required")
      return
    }

    setSubmitting(true)
    try {
      if (isStudent()) {
        const res = await saveStudentProfileEdit(selected.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || null,
          department: form.department || null,
          course: form.course || null,
          yearLevel: form.yearLevel || null,
          position: null,
          studentNumber: form.studentNumber || null,
          employeeNumber: null,
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
      } else {
        const fd = new FormData()
        fd.set("profileId", selected.id)
        fd.set("firstName", form.firstName)
        fd.set("lastName", form.lastName)
        fd.set("employeeNumber", form.employeeNumber)
        fd.set("department", form.department || "")
        fd.set("position", form.position || "")
        fd.set("phone", "")
        fd.set("activeStatus", "true")
        const res = await updateFacultyAccountAction(fd)
        if (res.error) {
          toast.error(res.error)
          return
        }
      }
      toast.success("Record updated successfully")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Edit Record"
        description="Update patient profile information."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Find Patient</CardTitle>
          <CardDescription className="text-xs">Search by name, student number, or employee number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Name, student number, or employee number"
              className="h-9"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Search className="size-3.5 mr-1" />}
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="divide-y rounded-lg border max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectPatient(r)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50/50 transition-colors text-left cursor-pointer"
                >
                  <User className="size-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                    <p className="text-xs text-zinc-500">
                      {"student_number" in r ? r.student_number : r.employee_number} · {r.department || "No department"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {"student_number" in r ? "Student" : "Faculty"}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
              <User className="size-4 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">{selected.first_name} {selected.last_name}</p>
                <p className="text-xs text-emerald-600">
                  {"student_number" in selected ? selected.student_number : selected.employee_number}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelected(null)}>Change</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Edit Patient Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                {isStudent() ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Student Number</Label>
                    <Input value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} className="h-9 font-mono" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employee Number</Label>
                    <Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} className="h-9 font-mono" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Department</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="h-9" />
                </div>
                {isStudent() ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Course</Label>
                    <Input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className="h-9" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Position</Label>
                    <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="h-9" />
                  </div>
                )}
              </div>

              {isStudent() && (
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

              <Button type="submit" disabled={submitting} className="cursor-pointer">
                {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Saving...</> : <><Pencil className="size-3.5 mr-1" /> Save Changes</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}