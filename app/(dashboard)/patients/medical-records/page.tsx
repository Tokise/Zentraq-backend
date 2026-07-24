"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, Search, HeartPulse, AlertTriangle } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatusBadge } from "@/components/status-badge"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { Pagination } from "@/components/pagination"

type MedicalRecord = {
  id: string
  student_number: string
  first_name: string
  last_name: string
  blood_type: string
  allergies: string
  medical_conditions: string
  emergency_contact_name: string
  emergency_contact_phone: string
  updated_at: string
}

const PAGE_SIZE = 8

export default function MedicalRecordsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)
  const [page, setPage] = useState(1)

  const fetchRecords = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("medical_records")
      .select("*")
      .order("last_name")

    if (!error && data) {
      setRecords(data as MedicalRecord[])
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchRecords()

    const channel = supabase
      .channel("medical_records_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medical_records",
        },
        () => {
          fetchRecords()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchRecords, supabase])

  const filteredRecords = records.filter((record) => {
    const keyword = searchQuery.toLowerCase().trim()
    if (!keyword) return true

    const firstName = record.first_name?.toLowerCase() ?? ""
    const lastName = record.last_name?.toLowerCase() ?? ""
    const studentNum = record.student_number?.toLowerCase() ?? ""
    const conditions = record.medical_conditions?.toLowerCase() ?? ""
    const allergies = record.allergies?.toLowerCase() ?? ""

    return (
      firstName.includes(keyword) ||
      lastName.includes(keyword) ||
      studentNum.includes(keyword) ||
      conditions.includes(keyword) ||
      allergies.includes(keyword)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paginatedRecords = filteredRecords.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Medical Records"
        description="View and manage patient medical histories, conditions, and allergies."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <SectionHeader
            title="Patient Medical Directory"
            description={`${records.length} registered health record(s)`}
          >
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, student no, condition..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
          </SectionHeader>
        </CardHeader>

        <CardContent>
          {paginatedRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <HeartPulse className="mb-4 size-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No medical records found</h3>
              <p className="text-sm text-muted-foreground">
                No record matches your search criteria.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student No.</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Blood Type</TableHead>
                    <TableHead>Known Allergies</TableHead>
                    <TableHead>Medical Conditions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <TableCell className="font-medium">
                        {record.student_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.first_name} {record.last_name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status="default">
                          {record.blood_type || "N/A"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {record.allergies && record.allergies !== "None" ? (
                          <span className="text-destructive font-medium flex items-center gap-1">
                            <AlertTriangle className="size-3.5 inline" />
                            {record.allergies}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.medical_conditions || "None reported"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={filteredRecords.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedRecord !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecord(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Patient Medical History</DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Student Number</p>
                  <p className="font-medium">{selectedRecord.student_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Blood Type</p>
                  <p className="font-medium">{selectedRecord.blood_type || "N/A"}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium text-lg">
                  {selectedRecord.first_name} {selectedRecord.last_name}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Allergies</p>
                <p className="font-medium text-destructive">
                  {selectedRecord.allergies || "None reported"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Chronic Conditions / History</p>
                <p className="text-sm bg-muted/40 p-3 rounded-md mt-1">
                  {selectedRecord.medical_conditions || "No chronic medical conditions on record."}
                </p>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Emergency Contact
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Contact Person</p>
                    <p className="font-medium">
                      {selectedRecord.emergency_contact_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone Number</p>
                    <p className="font-medium">
                      {selectedRecord.emergency_contact_phone || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}