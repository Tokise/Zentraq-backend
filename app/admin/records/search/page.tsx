"use client"

import { useState } from "react"
import { Search, Users } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { searchRecordsAction, type RecordSearchResult } from "@/actions/admin/records"

export default function AdminRecordSearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<RecordSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  async function search() {
    setLoading(true)
    const result = await searchRecordsAction(query)
    setLoading(false)
    if (result.error) return toast.error(result.error)
    setResults([...result.students, ...result.faculty])
  }
  return <main className="space-y-6"><PageHeader title="Medical Records" description="Find a student or faculty medical record." /><Card><CardContent className="p-6 space-y-5"><div className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Name, student number, or employee number" /><Button onClick={search} disabled={loading}><Search className="mr-2 size-4" />{loading ? "Searching" : "Search"}</Button></div>{results.length > 0 ? <div className="divide-y rounded-md border">{results.map((record) => <div key={record.id} className="flex items-center gap-3 p-4"><Users className="size-4 text-muted-foreground" /><div><p className="font-medium">{record.first_name} {record.last_name}</p><p className="text-sm text-muted-foreground">{"student_number" in record ? record.student_number : record.employee_number} · {record.department ?? "No department"}</p></div><span className="ml-auto text-xs capitalize text-muted-foreground">{record.status}</span></div>)}</div> : <p className="py-10 text-center text-sm text-muted-foreground">Search to view records.</p>}</CardContent></Card></main>
}
