"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/admin/records"

export default function DoctorRecordsSearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)

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

  return (
    <div className="space-y-6">
      <PageHeader title="Search Records" description="Find patient medical records." />

      <Card className="shadow-sm">
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, student number, or employee number"
              className="h-9"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 cursor-pointer">
              {searching ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Search className="size-3.5 mr-1" />}
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{r.first_name} {r.last_name}</TableCell>
                      <TableCell className="font-mono text-xs">{"student_number" in r ? r.student_number : r.employee_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{"student_number" in r ? "Student" : "Faculty"}</Badge>
                      </TableCell>
                      <TableCell className="text-zinc-600">{r.department || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}