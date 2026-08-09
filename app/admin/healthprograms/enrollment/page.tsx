"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Users, Plus } from "lucide-react"
import { toast } from "sonner"
import { getSettingsAction, updateSettingAction } from "@/actions/admin/settings"
import { searchRecordsAction } from "@/actions/admin/records/search"

interface Enrollment {
  id: string
  program_id: string
  program_name: string
  patient_id: string
  patient_name: string
  patient_type: "student" | "faculty"
  enrolled_at: string
  status: "active" | "completed" | "dropped"
}

export default function AdminHealthProgramEnrollmentPage() {
  const [programs, setPrograms] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProgram, setSelectedProgram] = useState<string>("")
  const [showEnroll, setShowEnroll] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Record<string, any> | null>(null)
  const [enrolling, setEnrolling] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSettingsAction()
      if (res.error) {
        toast.error(res.error)
        return
      }
      const existing = res.settings.find((s) => s.key === "health_programs")
      const programList = existing?.value?.programs || []
      setPrograms(programList)
      if (programList.length > 0 && !selectedProgram) {
        setSelectedProgram(programList[0].id)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load programs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  async function handleEnroll() {
    if (!selectedPatient || !selectedProgram) return
    setEnrolling(true)
    try {
      const program = programs.find((p) => p.id === selectedProgram)
      const newEnrollment: Enrollment = {
        id: `enr-${Date.now()}`,
        program_id: selectedProgram,
        program_name: program?.name || "Unknown Program",
        patient_id: selectedPatient.id,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        patient_type: "student_number" in selectedPatient ? "student" : "faculty",
        enrolled_at: new Date().toISOString(),
        status: "active",
      }
      setEnrollments((prev) => [newEnrollment, ...prev])
      toast.success("Patient enrolled successfully")
      setShowEnroll(false)
      setSelectedPatient(null)
      setQuery("")
      setResults([])
    } finally {
      setEnrolling(false)
    }
  }

  const programEnrollments = enrollments.filter((e) => e.program_id === selectedProgram)
  const programName = programs.find((p) => p.id === selectedProgram)?.name || ""

  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Enrollment"
        description="Enroll patients in health programs."
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
        >
          <option value="">Select Program</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Button size="sm" onClick={() => { setShowEnroll(true); setSelectedPatient(null); setQuery(""); setResults([]); }} disabled={!selectedProgram} className="cursor-pointer">
          <Plus className="size-3.5 mr-1" /> Enroll Patient
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{programName} — Enrolled Patients</CardTitle>
            <CardDescription className="text-xs">{programEnrollments.length} enrolled</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {programEnrollments.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="size-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No enrollments yet for this program.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Patient</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Enrolled</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {programEnrollments.map((e) => (
                      <tr key={e.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-medium">{e.patient_name}</td>
                        <td className="px-4 py-3 capitalize">{e.patient_type}</td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(e.enrolled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] capitalize ${
                            e.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            e.status === "completed" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-zinc-50 text-zinc-500 border-zinc-200"
                          }`}>
                            {e.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enrollment modal */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="shadow-lg w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="text-base">Enroll Patient</CardTitle>
              <CardDescription className="text-xs">Search for a student or faculty member.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Name, student number, or employee number" className="h-9" />
                <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
                  {searching ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
                </Button>
              </div>

              {results.length > 0 && (
                <div className="divide-y rounded-lg border max-h-64 overflow-y-auto">
                  {results.map((r) => (
                    <button key={r.id} onClick={() => { setSelectedPatient(r); setResults([]); setQuery(""); }} className="w-full text-left p-3 hover:bg-zinc-50/50 cursor-pointer">
                      <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                      <p className="text-xs text-zinc-500">{"student_number" in r ? r.student_number : r.employee_number}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedPatient && (
                <div className="rounded-lg bg-emerald-50/50 border border-emerald-200 p-3">
                  <p className="text-sm font-medium text-emerald-800">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                  <p className="text-xs text-emerald-600">{"student_number" in selectedPatient ? selectedPatient.student_number : selectedPatient.employee_number}</p>
                </div>
              )}
            </CardContent>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button variant="outline" onClick={() => setShowEnroll(false)}>Cancel</Button>
              <Button onClick={handleEnroll} disabled={enrolling || !selectedPatient}>
                {enrolling ? "Enrolling..." : "Enroll"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}