"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, Search, Users } from "lucide-react"
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

type Patient = {
  id: string
  student_number: string
  first_name: string
  last_name: string
  email: string
  department: string
  rfid_uid: string
  active_status: boolean
}

const PAGE_SIZE = 8

export default function PatientsPage() {
  // Memoize client to prevent recreation on every re-render
  const supabase = useMemo(() => createClient(), [])

  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [page, setPage] = useState(1)

  const fetchPatients = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("student_accounts")
      .select("*")
      .order("last_name")

    if (!error && data) {
      setPatients(data as Patient[])
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchPatients()

    const channel = supabase
      .channel("student_accounts_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_accounts",
        },
        () => {
          fetchPatients()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPatients, supabase])

  // Filter patients with safe optional chaining against null DB fields
  const filteredPatients = patients.filter((patient) => {
    const keyword = searchQuery.toLowerCase().trim()
    if (!keyword) return true

    const firstName = patient.first_name?.toLowerCase() ?? ""
    const lastName = patient.last_name?.toLowerCase() ?? ""
    const studentNum = patient.student_number?.toLowerCase() ?? ""
    const email = patient.email?.toLowerCase() ?? ""

    return (
      firstName.includes(keyword) ||
      lastName.includes(keyword) ||
      studentNum.includes(keyword) ||
      email.includes(keyword)
    )
  })

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPatients.length / PAGE_SIZE)
  )

  const safePage = Math.min(page, totalPages)

  const paginatedPatients = filteredPatients.slice(
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
        title="Patients"
        description="Manage patient profiles and clinic records."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <SectionHeader
            title="Patient Directory"
            description={`${patients.length} registered patient(s)`}
          >
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patient..."
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
          {paginatedPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-4 size-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No patients found</h3>
              <p className="text-sm text-muted-foreground">
                No patient matches your search criteria.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student No.</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>RFID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPatients.map((patient) => (
                    <TableRow
                      key={patient.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedPatient(patient)}
                    >
                      <TableCell className="font-medium">
                        {patient.student_number}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {patient.first_name} {patient.last_name}
                        </span>
                      </TableCell>
                      <TableCell>{patient.department}</TableCell>
                      <TableCell>{patient.email}</TableCell>
                      <TableCell>{patient.rfid_uid}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={
                            patient.active_status ? "success" : "danger"
                          }
                        >
                          {patient.active_status ? "Active" : "Inactive"}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={filteredPatients.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedPatient !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setSelectedPatient(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Patient Information</DialogTitle>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Student Number
                  </p>
                  <p className="font-medium">
                    {selectedPatient.student_number}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RFID UID</p>
                  <p className="font-medium">{selectedPatient.rfid_uid}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium text-lg">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p>{selectedPatient.email}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p>{selectedPatient.department}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge
                  status={
                    selectedPatient.active_status ? "success" : "danger"
                  }
                >
                  {selectedPatient.active_status ? "Active" : "Inactive"}
                </StatusBadge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}