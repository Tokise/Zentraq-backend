"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/admin/records"
import { createWalkInVisit } from "@/actions/clinical/visits"

export default function DoctorNewVisitPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Record<string, any> | null>(null)
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

  async function handleCheckIn() {
    if (!selected) return
    setSubmitting(true)
    try {
      const patientType = "student_number" in selected ? "student" : "faculty"
      const idField = patientType === "student" ? "student_id" : "faculty_id"
      const res = await createWalkInVisit({
        patient_type: patientType,
        [idField]: selected.id,
        visit_type: "walk-in",
        status: "in-progress",
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`${selected.first_name} ${selected.last_name} checked in`)
        setSelected(null)
        setQuery("")
        setResults([])
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to check in patient")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="New Walk-in Visit" description="Check in a patient for a consultation." />

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
                  onClick={() => { setSelected(r); setResults([]); setQuery("") }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50/50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                    <p className="text-xs text-zinc-500">
                      {"student_number" in r ? r.student_number : r.employee_number} · {r.department || "No department"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">{selected.first_name} {selected.last_name}</p>
                <p className="text-xs text-emerald-600">
                  {"student_number" in selected ? selected.student_number : selected.employee_number}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelected(null)}>Change</Button>
            </div>
          )}

          <Button onClick={handleCheckIn} disabled={submitting || !selected} className="w-full cursor-pointer">
            {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Checking in...</> : <><UserPlus className="size-3.5 mr-1" /> Check In Patient</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}