"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import {
  Search,
  RefreshCw,
  X,
  Pencil,
  Check,
  Users,
  GraduationCap,
  Briefcase,
  UserX,
  UserCheck,
  Mail,
  Building2,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type RoleFilter = "all" | "student" | "employee"
type StatusFilter = "all" | "active" | "inactive" | "archived"

interface PatientProfile {
  id: string
  rfid_uid: string
  first_name: string
  last_name: string
  email: string | null
  department: string | null
  course: string | null
  year_level: string | null
  position: string | null
  student_number: string | null
  employee_number: string | null
  clinic_photo_url: string | null
  active_status: boolean
  archived_at: string | null
  created_at: string
}

const STUDENT_ID_PREFIX = "23011-"
const PAGE_SIZE = 15

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [page, setPage] = useState(1)

  // Detail / edit panel
  const [selected, setSelected] = useState<PatientProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: "", lastName: "", email: "", department: "",
    course: "", yearLevel: "", position: "", idSuffix: "", employeeId: "",
  })

  const supabase = createClient()

  const fetchPatients = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const { data, error } = await supabase
        .from("student_accounts")
        .select("*")
        .order("last_name", { ascending: true })

      if (error) throw error
      setPatients((data as PatientProfile[]) || [])
    } catch (err: any) {
      toast.error(err.message || "Failed to load patients")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  // Escape closes the detail panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return patients.filter((p) => {
      if (roleFilter === "student" && !p.student_number) return false
      if (roleFilter === "employee" && !p.employee_number) return false

      if (statusFilter === "archived") {
        if (!p.archived_at) return false
      } else {
        // Archived patients never show up outside the dedicated tab
        if (p.archived_at) return false
        if (statusFilter === "active" && !p.active_status) return false
        if (statusFilter === "inactive" && p.active_status) return false
      }

      if (!q) return true
      const haystack = [
        p.first_name, p.last_name, p.email, p.student_number,
        p.employee_number, p.department, p.course, p.position, p.rfid_uid,
      ].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [patients, search, roleFilter, statusFilter])

  // Reset to page 1 whenever the filtered set changes shape (search/filter change)
  useEffect(() => {
    setPage(1)
  }, [search, roleFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const counts = useMemo(() => {
    const nonArchived = patients.filter((p) => !p.archived_at)
    return {
      all: nonArchived.length,
      student: nonArchived.filter((p) => p.student_number).length,
      employee: nonArchived.filter((p) => p.employee_number).length,
      active: nonArchived.filter((p) => p.active_status).length,
      inactive: nonArchived.filter((p) => !p.active_status).length,
      archived: patients.filter((p) => p.archived_at).length,
    }
  }, [patients])

  function openPanel(p: PatientProfile) {
    setSelected(p)
    setEditing(false)
  }

  function closePanel() {
    setSelected(null)
    setEditing(false)
  }

  function startEdit() {
    if (!selected) return
    const suffix = selected.student_number?.startsWith(STUDENT_ID_PREFIX)
      ? selected.student_number.slice(STUDENT_ID_PREFIX.length)
      : (selected.student_number?.match(/(\d{4})$/)?.[1] || "")
    setEditForm({
      firstName: selected.first_name || "",
      lastName: selected.last_name || "",
      email: selected.email || "",
      department: selected.department || "",
      course: selected.course || "",
      yearLevel: selected.year_level || "",
      position: selected.position || "",
      idSuffix: suffix,
      employeeId: selected.employee_number || "",
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    const isStudent = !!selected.student_number
    if (!editForm.firstName || !editForm.lastName) {
      toast.error("First and last name are required.")
      return
    }
    if (isStudent && editForm.idSuffix.length !== 4) {
      toast.error("Student ID must have 4 digits.")
      return
    }
    if (!isStudent && !editForm.employeeId) {
      toast.error("Employee number is required.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        email: editForm.email || null,
        department: editForm.department || null,
        course: isStudent ? (editForm.course || null) : null,
        year_level: isStudent ? (editForm.yearLevel || null) : null,
        position: !isStudent ? (editForm.position || null) : null,
        student_number: isStudent ? `${STUDENT_ID_PREFIX}${editForm.idSuffix}` : null,
        employee_number: !isStudent ? editForm.employeeId : null,
      }

      const { data, error } = await supabase
        .from("student_accounts")
        .update(payload)
        .eq("id", selected.id)
        .select()
        .maybeSingle()

      if (error) throw error

      let updated = data as PatientProfile | null
      if (!updated) {
        const { data: refetched } = await supabase
          .from("student_accounts")
          .select("*")
          .eq("id", selected.id)
          .maybeSingle()
        updated = refetched as PatientProfile | null
      }

      toast.success("Profile updated")
      setPatients((prev) => prev.map((p) => (p.id === selected.id ? (updated || { ...p, ...payload }) : p)))
      setSelected(updated || { ...selected, ...payload })
      setEditing(false)
    } catch (err: any) {
      toast.error(err.message || "Update failed")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: PatientProfile) {
    try {
      const { data, error } = await supabase
        .from("student_accounts")
        .update({ active_status: !p.active_status })
        .eq("id", p.id)
        .select()
        .maybeSingle()

      if (error) throw error
      const updated = (data as PatientProfile) || { ...p, active_status: !p.active_status }
      setPatients((prev) => prev.map((row) => (row.id === p.id ? updated : row)))
      if (selected?.id === p.id) setSelected(updated)
      toast.success(updated.active_status ? "Marked active" : "Marked inactive")
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    }
  }

  async function toggleArchived(p: PatientProfile) {
    try {
      const nextArchivedAt = p.archived_at ? null : new Date().toISOString()
      const { data, error } = await supabase
        .from("student_accounts")
        .update({ archived_at: nextArchivedAt })
        .eq("id", p.id)
        .select()
        .maybeSingle()

      if (error) throw error
      const updated = (data as PatientProfile) || { ...p, archived_at: nextArchivedAt }
      setPatients((prev) => prev.map((row) => (row.id === p.id ? updated : row)))
      if (selected?.id === p.id) {
        if (!updated.archived_at) {
          setSelected(updated)
        } else {
          // Archived patient no longer belongs in the currently open panel
          closePanel()
        }
      }
      toast.success(updated.archived_at ? "Moved to archive" : "Restored from archive")
    } catch (err: any) {
      toast.error(err.message || "Failed to update archive status")
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-4">
      <PageHeader
        title="Users Management"
        description="Everyone registered through RFID — students, faculty, and staff."
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, email..."
            className="h-9 pl-8 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPatients(true)}
            disabled={refreshing}
            className="h-9 text-xs"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([
          { key: "all", label: "All", icon: Users, count: counts.all },
          { key: "student", label: "Students", icon: GraduationCap, count: counts.student },
          { key: "employee", label: "Faculty & Staff", icon: Briefcase, count: counts.employee },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setRoleFilter(key)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${roleFilter === key
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              }`}
          >
            <Icon className="size-3.5" />
            {label}
            <span className={`text-[10px] ${roleFilter === key ? "text-zinc-300" : "text-zinc-400"}`}>{count}</span>
          </button>
        ))}

        <div className="w-px h-5 bg-zinc-200 mx-1" />

        {([
          { key: "active", label: "Active", count: counts.active },
          { key: "inactive", label: "Inactive", count: counts.inactive },
          { key: "all", label: "All statuses", count: counts.all },
        ] as const).map(({ key, label, count }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(key)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${statusFilter === key
              ? "bg-zinc-100 text-zinc-900 border-zinc-300"
              : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"
              }`}
          >
            {label}
            <span className="text-[10px] text-zinc-400">{count}</span>
          </button>
        ))}

        <button
          onClick={() => setStatusFilter("archived")}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${statusFilter === "archived"
            ? "bg-amber-100 text-amber-900 border-amber-300"
            : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"
            }`}
        >
          <Archive className="size-3.5" />
          Archived
          <span className="text-[10px] text-zinc-400">{counts.archived}</span>
        </button>
      </div>

      {/* List */}
      <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="size-9 rounded-full bg-zinc-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-zinc-100 rounded" />
                    <div className="h-2.5 w-24 bg-zinc-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-1.5">
              {statusFilter === "archived" ? (
                <Archive className="size-7 text-zinc-300 mx-auto" />
              ) : (
                <Users className="size-7 text-zinc-300 mx-auto" />
              )}
              <p className="text-sm font-medium text-zinc-600">
                {patients.length === 0
                  ? "No one's registered yet"
                  : statusFilter === "archived"
                    ? "Nothing archived"
                    : "No matches"}
              </p>
              <p className="text-xs text-zinc-400">
                {patients.length === 0
                  ? "Registered cards will show up here automatically."
                  : statusFilter === "archived"
                    ? "Patients you archive will show up here."
                    : "Try a different search or filter."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {paginated.map((p) => {
                const isStudent = !!p.student_number
                const idLabel = p.student_number || p.employee_number || "—"
                const subLabel = isStudent
                  ? [p.course, p.year_level ? `Yr ${p.year_level}` : null].filter(Boolean).join(" • ")
                  : p.position || "—"
                return (
                  <div
                    key={p.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/80 transition-colors"
                  >
                    <button onClick={() => openPanel(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <Avatar className="size-9 rounded-full border border-zinc-200 bg-zinc-50 shrink-0">
                        <AvatarImage src={p.clinic_photo_url || ""} className="object-cover" />
                        <AvatarFallback className="text-xs font-bold bg-zinc-100 text-zinc-500">
                          {p.first_name[0]}{p.last_name[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-900 truncate">
                            {p.first_name} {p.last_name}
                          </span>
                          {!p.active_status && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-zinc-400 border-zinc-200">
                              Inactive
                            </Badge>
                          )}
                          {p.archived_at && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-200 bg-amber-50">
                              Archived
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 truncate">{subLabel}</p>
                      </div>

                      <div className="hidden sm:block text-right shrink-0">
                        <p className="text-xs font-mono text-zinc-600">{idLabel}</p>
                        <p className="text-[10px] text-zinc-400">{p.department || "—"}</p>
                      </div>

                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] capitalize ${isStudent ? "text-blue-600 border-blue-200 bg-blue-50" : "text-purple-600 border-purple-200 bg-purple-50"
                          }`}
                      >
                        {isStudent ? "Student" : "Employee"}
                      </Badge>
                    </button>

                    <button
                      onClick={() => toggleArchived(p)}
                      title={p.archived_at ? "Restore" : "Archive"}
                      className="shrink-0 p-1.5 rounded-md text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      {p.archived_at ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-zinc-400">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="size-3.5 mr-1" />
              Prev
            </Button>
            <span className="text-xs text-zinc-500 tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail / edit panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closePanel}
        >
          <Card
            className="w-full max-w-md max-h-[90vh] overflow-y-auto border-zinc-200/80 shadow-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="size-14 rounded-full border border-zinc-200 bg-zinc-50">
                    <AvatarImage src={selected.clinic_photo_url || ""} className="object-cover" />
                    <AvatarFallback className="text-base font-bold bg-zinc-100 text-zinc-500">
                      {selected.first_name[0]}{selected.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-900">
                      {selected.first_name} {selected.last_name}
                    </h3>
                    <p className="text-xs font-mono text-zinc-400">
                      {selected.student_number || selected.employee_number}
                    </p>
                  </div>
                </div>
                <button onClick={closePanel} className="text-zinc-300 hover:text-zinc-500">
                  <X className="size-4" />
                </button>
              </div>

              {!editing ? (
                <>
                  <div className="text-xs space-y-2 divide-y divide-zinc-100">
                    <div className="flex justify-between py-1.5">
                      <span className="text-zinc-400 flex items-center gap-1"><Mail className="size-3" /> Email</span>
                      <span className="text-zinc-700">{selected.email || "—"}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-zinc-400 flex items-center gap-1"><Building2 className="size-3" /> Department</span>
                      <span className="text-zinc-700">{selected.department || "—"}</span>
                    </div>
                    {selected.student_number ? (
                      <div className="flex justify-between py-1.5">
                        <span className="text-zinc-400">Course</span>
                        <span className="text-zinc-700">
                          {selected.course || "—"}{selected.year_level ? ` — Year ${selected.year_level}` : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between py-1.5">
                        <span className="text-zinc-400">Position</span>
                        <span className="text-zinc-700">{selected.position || "—"}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5">
                      <span className="text-zinc-400">RFID UID</span>
                      <span className="font-mono text-zinc-700">{selected.rfid_uid}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-zinc-400">Status</span>
                      <span className={selected.active_status ? "text-emerald-600" : "text-zinc-400"}>
                        {selected.active_status ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-zinc-400">Archive</span>
                      <span className={selected.archived_at ? "text-amber-600" : "text-zinc-400"}>
                        {selected.archived_at ? "Archived" : "Not archived"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-zinc-100">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={startEdit}>
                      <Pencil className="size-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => toggleActive(selected)}
                    >
                      {selected.active_status ? (
                        <><UserX className="size-3.5 mr-1.5" /> Deactivate</>
                      ) : (
                        <><UserCheck className="size-3.5 mr-1.5" /> Activate</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => toggleArchived(selected)}
                    >
                      {selected.archived_at ? (
                        <><ArchiveRestore className="size-3.5 mr-1.5" /> Restore</>
                      ) : (
                        <><Archive className="size-3.5 mr-1.5" /> Archive</>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">First Name</Label>
                      <Input
                        value={editForm.firstName}
                        onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name</Label>
                      <Input
                        value={editForm.lastName}
                        onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {selected.student_number ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Student No.</Label>
                      <div className="flex items-center gap-1.5">
                        <div className="h-9 px-2.5 flex items-center rounded-md border border-zinc-200 bg-zinc-50 text-sm font-mono text-zinc-500 shrink-0">
                          {STUDENT_ID_PREFIX}
                        </div>
                        <Input
                          value={editForm.idSuffix}
                          onChange={(e) => setEditForm((f) => ({ ...f, idSuffix: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                          inputMode="numeric"
                          maxLength={4}
                          className="h-9 font-mono tracking-widest"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Employee No.</Label>
                      <Input
                        value={editForm.employeeId}
                        onChange={(e) => setEditForm((f) => ({ ...f, employeeId: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Department</Label>
                    <Input
                      value={editForm.department}
                      onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                      className="h-9"
                    />
                  </div>

                  {selected.student_number ? (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Course</Label>
                        <Input
                          value={editForm.course}
                          onChange={(e) => setEditForm((f) => ({ ...f, course: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Year</Label>
                        <Input
                          value={editForm.yearLevel}
                          onChange={(e) => setEditForm((f) => ({ ...f, yearLevel: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Position</Label>
                      <Input
                        value={editForm.position}
                        onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-zinc-100">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs bg-zinc-900 text-white hover:bg-zinc-800"
                      onClick={saveEdit}
                      disabled={saving}
                    >
                      {saving ? <RefreshCw className="size-3.5 mr-1.5 animate-spin" /> : <Check className="size-3.5 mr-1.5" />}
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}