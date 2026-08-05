"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, User, HeartPulse } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/admin/records"
import { getPatientMedicalRecord, type PatientMedicalRecord } from "@/actions/clinical/records"
import { MedicalRecordView } from "@/components/medical/medical-record-view"

export default function AdminStaffHealthRecordPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await searchRecordsAction(query)
      if (res.error) {
        toast.error(res.error)
        setResults([])
      } else {
        setResults(res.faculty)
      }
    } finally {
      setSearching(false)
    }
  }

  async function loadRecord(id: string) {
    setLoadingRecord(true)
    setRecord(null)
    setResults([])
    setQuery("")
    try {
      const res = await getPatientMedicalRecord(id, "faculty")
      if (res.error) {
        toast.error(res.error)
      } else if (res.record) {
        setRecord(res.record)
      } else {
        toast.error("No medical record found for this faculty member")
      }
    } finally {
      setLoadingRecord(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Health Record"
        description="View and manage faculty health records."
      />

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search faculty by name or employee number"
              className="h-9"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Search className="size-3.5 mr-1" />}
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="mt-3 divide-y rounded-lg border max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRecord(r.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50/50 transition-colors text-left cursor-pointer"
                >
                  <User className="size-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                    <p className="text-xs text-zinc-500">
                      {r.employee_number} · {r.department || "No department"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Faculty</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loadingRecord ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : record ? (
        <MedicalRecordView record={record} canEdit={true} />
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <HeartPulse className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Search for a faculty member to view their health record.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}