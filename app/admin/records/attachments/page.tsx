"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, User, Paperclip, Download } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction } from "@/actions/admin/records"
import { getStudentDocumentsAction, addStudentDocumentAction } from "@/actions/admin/records-admin"

export default function AdminRecordsAttachmentsPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<Record<string, any>>>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Record<string, any> | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ document_type: "", file_name: "", file_url: "" })
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
        setResults([...res.students, ...res.faculty].filter((r) => "student_number" in r))
      }
    } finally {
      setSearching(false)
    }
  }

  async function selectStudent(r: Record<string, any>) {
    setSelected(r)
    setResults([])
    setQuery("")
    setLoadingDocs(true)
    try {
      const res = await getStudentDocumentsAction(r.id)
      if (res.error) {
        toast.error(res.error)
        setDocuments([])
      } else {
        setDocuments(res.documents)
      }
    } finally {
      setLoadingDocs(false)
    }
  }

  async function handleAddDocument() {
    if (!selected || !form.document_type.trim() || !form.file_name.trim() || !form.file_url.trim()) {
      toast.error("Document type, file name, and URL are required")
      return
    }
    setSubmitting(true)
    try {
      const res = await addStudentDocumentAction({
        studentId: selected.id,
        documentType: form.document_type,
        fileName: form.file_name,
        fileUrl: form.file_url,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Document attached")
        setForm({ document_type: "", file_name: "", file_url: "" })
        setShowAdd(false)
        selectStudent(selected)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record Attachments"
        description="View and manage document attachments for student records."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Find Student</CardTitle>
          <CardDescription className="text-xs">Search by name or student number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Student name or number"
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
                  onClick={() => selectStudent(r)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50/50 transition-colors text-left cursor-pointer"
                >
                  <User className="size-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                    <p className="text-xs text-zinc-500">{r.student_number}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Student</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{selected.first_name} {selected.last_name}</CardTitle>
                <CardDescription className="text-xs">{selected.student_number}</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="cursor-pointer">
                <Paperclip className="size-3.5 mr-1" /> {showAdd ? "Cancel" : "Attach Document"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAdd && (
              <div className="mb-6 rounded-lg border border-zinc-200 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Document Type <span className="text-red-500">*</span></Label>
                    <select
                      value={form.document_type}
                      onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                      className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none"
                    >
                      <option value="">Select type</option>
                      <option value="medical_certificate">Medical Certificate</option>
                      <option value="lab_result">Lab Result</option>
                      <option value="clearance">Clearance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">File Name <span className="text-red-500">*</span></Label>
                    <Input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} placeholder="e.g. certificate.pdf" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">File URL <span className="text-red-500">*</span></Label>
                    <Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="Storage URL or path" className="h-9" />
                  </div>
                </div>
                <Button size="sm" onClick={handleAddDocument} disabled={submitting} className="cursor-pointer">
                  {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1" /> Saving...</> : "Attach Document"}
                </Button>
              </div>
            )}

            {loadingDocs ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="py-10 text-center">
                <Paperclip className="size-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No documents attached for this student.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Uploaded</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{doc.file_name || "Unnamed"}</td>
                        <td className="px-4 py-3 text-zinc-600">{doc.document_type.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer">
                              <Download className="size-3.5 mr-1" /> View
                            </Button>
                          </a>
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
    </div>
  )
}