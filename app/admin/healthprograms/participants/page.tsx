"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, Users, Search } from "lucide-react"
import { toast } from "sonner"
import { getSettingsAction } from "@/actions/admin/settings"
import { searchRecordsAction } from "@/actions/admin/records/search"

interface Participant {
  id: string
  program_id: string
  program_name: string
  patient_id: string
  patient_name: string
  patient_type: "student" | "faculty"
  enrolled_at: string
  status: "active" | "completed" | "dropped"
}

export default function AdminHealthProgramParticipantsPage() {
  const [programs, setPrograms] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProgram, setSelectedProgram] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredEnrollments, setFilteredEnrollments] = useState<Participant[]>([])

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

  useEffect(() => {
    const stored = localStorage.getItem("health_program_enrollments")
    if (stored) {
      try {
        setEnrollments(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEnrollments(enrollments.filter((e) => e.program_id === selectedProgram))
    } else {
      const q = searchQuery.toLowerCase()
      setFilteredEnrollments(
        enrollments.filter((e) => e.program_id === selectedProgram && e.patient_name.toLowerCase().includes(q))
      )
    }
  }, [searchQuery, enrollments, selectedProgram])

  const handleSearchPatients = async () => {
    if (!searchQuery.trim()) return
    try {
      const res = await searchRecordsAction(searchQuery)
      if (res.error) {
        toast.error(res.error)
        return
      }
      const matches = [...res.students, ...res.faculty]
      const existingIds = new Set(enrollments.map((e) => e.patient_id))
      const newMatches = matches.filter((m) => !existingIds.has(m.id))
      if (newMatches.length === 0) {
        toast.info("No new patients match your search")
        return
      }
      const program = programs.find((p) => p.id === selectedProgram)
      const newEnrollments: Participant[] = newMatches.map((m) => ({
        id: `enr-${Date.now()}-${m.id}`,
        program_id: selectedProgram,
        program_name: program?.name || "Unknown",
        patient_id: m.id,
        patient_name: `${m.first_name} ${m.last_name}`,
        patient_type: "student_number" in m ? "student" : "faculty",
        enrolled_at: new Date().toISOString(),
        status: "active" as const,
      }))
      const updated = [...newEnrollments, ...enrollments]
      setEnrollments(updated)
      localStorage.setItem("health_program_enrollments", JSON.stringify(updated))
      toast.success(`${newMatches.length} patient(s) enrolled`)
      setSearchQuery("")
    } catch (err: any) {
      toast.error(err.message || "Search failed")
    }
  }

  const handleStatusChange = (enrollmentId: string, status: Participant["status"]) => {
    const updated = enrollments.map((e) => (e.id === enrollmentId ? { ...e, status } : e))
    setEnrollments(updated)
    localStorage.setItem("health_program_enrollments", JSON.stringify(updated))
    toast.success("Status updated")
  }

  const handleRemove = (enrollmentId: string) => {
    if (!confirm("Remove this participant?")) return
    const updated = enrollments.filter((e) => e.id !== enrollmentId)
    setEnrollments(updated)
    localStorage.setItem("health_program_enrollments", JSON.stringify(updated))
    toast.success("Participant removed")
  }

  const programName = programs.find((p) => p.id === selectedProgram)?.name || ""

  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Participants"
        description="View and manage participants in health programs."
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

        {selectedProgram && (
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchPatients()}
              placeholder="Search patients to enroll..."
              className="h-9"
            />
            <Button size="sm" onClick={handleSearchPatients} disabled={!searchQuery.trim()} className="cursor-pointer">
              <Search className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : selectedProgram ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{programName}</CardTitle>
            <CardDescription className="text-xs">{filteredEnrollments.length} participant(s)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredEnrollments.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="size-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No participants yet. Search and enroll patients above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEnrollments.map((e) => (
                      <TableRow key={e.id} className="hover:bg-zinc-50/50">
                        <TableCell className="font-medium">{e.patient_name}</TableCell>
                        <TableCell className="capitalize">{e.patient_type}</TableCell>
                        <TableCell className="text-zinc-500">
                          {new Date(e.enrolled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <select
                            value={e.status}
                            onChange={(ev) => handleStatusChange(e.id, ev.target.value as Participant["status"])}
                            className="h-7 px-2 rounded-md border border-zinc-200 bg-white text-xs focus:outline-none"
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="dropped">Dropped</option>
                          </select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => handleRemove(e.id)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Select a program to view participants.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}