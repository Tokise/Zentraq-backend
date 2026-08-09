"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import {
  approveAndPublishHealthProgram,
  getHealthPrograms,
  proposeHealthProgram,
  type HealthProgram,
} from "@/actions/inventory/health-programs"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTablePagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type ClinicRole = "admin" | "doctor" | "nurse"
type PatientRole = "student" | "faculty" | "staff"
const PAGE_SIZE = 10

// Renders proposals for clinicians and atomic approval controls for Admin.
export function HealthProgramsWorkspace({ role }: { role: ClinicRole }) {
  const [programs, setPrograms] = useState<HealthProgram[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Loads the clinic-visible program list in deterministic newest-first order.
  const loadPrograms = useCallback(async () => {
    setLoading(true)
    const result = await getHealthPrograms()
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      setPrograms([])
      return
    }
    setPrograms(result.programs)
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadPrograms()
    }, 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadPrograms])

  const totalPages = Math.ceil(programs.length / PAGE_SIZE)
  const rows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return programs.slice(start, start + PAGE_SIZE)
  }, [page, programs])

  // Approves and publishes a pending proposal as one atomic operation.
  async function approve(programId: string) {
    setApprovingId(programId)
    const result = await approveAndPublishHealthProgram(programId)
    setApprovingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Health program approved and published")
    setPage(1)
    await loadPrograms()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          role === "admin"
            ? "Review proposals and publish targeted clinic programs."
            : "Review active programs or propose a targeted program for Admin approval."
        }
        title="Health Programs"
      >
        {role !== "admin" && (
          <Button onClick={() => setProposalOpen(true)} type="button">
            <Plus className="size-4" />
            Propose program
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                {role === "admin" && <TableHead className="w-40">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={`program-skeleton-${index}`}>
                    {Array.from(
                      { length: role === "admin" ? 5 : 4 },
                      (_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-5 w-full max-w-40" />
                        </TableCell>
                      ),
                    )}
                  </TableRow>
                ))
              ) : rows.length ? (
                rows.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell>
                      <p className="font-medium">{program.name}</p>
                      {program.description && (
                        <p className="max-w-md truncate text-xs text-muted-foreground">
                          {program.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{program.program_type}</TableCell>
                    <TableCell className="capitalize">
                      {(program.target_audience ?? []).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge className="capitalize" variant="outline">
                        {program.workflow_status}
                      </Badge>
                    </TableCell>
                    {role === "admin" && (
                      <TableCell>
                        {program.workflow_status === "pending" ? (
                          <Button
                            disabled={approvingId === program.id}
                            onClick={() => void approve(program.id)}
                            size="sm"
                            type="button"
                          >
                            {approvingId === program.id && (
                              <Loader2 className="size-4 animate-spin" />
                            )}
                            Approve & Publish
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Published</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="py-16 text-center" colSpan={5}>
                    No health programs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DataTablePagination
        currentPage={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        totalItems={programs.length}
        totalPages={totalPages}
      />
      <ProposalDialog
        onChanged={async () => {
          setPage(1)
          await loadPrograms()
        }}
        onOpenChange={setProposalOpen}
        open={proposalOpen}
      />
    </div>
  )
}

// Collects one targeted Doctor or Nurse health-program proposal.
function ProposalDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => Promise<void>
}) {
  const [programType, setProgramType] = useState("wellness")
  const [audience, setAudience] = useState<PatientRole[]>(["student"])
  const [submitting, setSubmitting] = useState(false)

  // Toggles one audience without allowing an empty target group.
  function toggleAudience(value: PatientRole) {
    setAudience((current) => {
      if (current.includes(value)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== value)
      }
      return [...current, value]
    })
  }

  // Validates and submits one pending proposal for Admin review.
  async function submitProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    const result = await proposeHealthProgram({
      name: formData.get("name"),
      description: String(formData.get("description") ?? "") || undefined,
      program_type: programType,
      start_date: String(formData.get("startDate") ?? "") || undefined,
      end_date: String(formData.get("endDate") ?? "") || undefined,
      target_audience: audience,
    })
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Health program proposal submitted")
    form.reset()
    onOpenChange(false)
    await onChanged()
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose health program</DialogTitle>
          <DialogDescription>
            Admin approval publishes the program and notifies its selected audience.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitProposal}>
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" />
          </Field>
          <Field label="Program type">
            <Select onValueChange={(value) => setProgramType(String(value))} value={programType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wellness">Wellness</SelectItem>
                <SelectItem value="screening">Screening</SelectItem>
                <SelectItem value="immunization">Immunization</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date">
              <Input name="startDate" type="date" />
            </Field>
            <Field label="End date">
              <Input name="endDate" type="date" />
            </Field>
          </div>
          <Field label="Target audience">
            <div className="flex flex-wrap gap-2">
              {(["student", "faculty", "staff"] as PatientRole[]).map((value) => (
                <Button
                  aria-pressed={audience.includes(value)}
                  key={value}
                  onClick={() => toggleAudience(value)}
                  type="button"
                  variant={audience.includes(value) ? "default" : "outline"}
                >
                  <span className="capitalize">{value}</span>
                </Button>
              ))}
            </div>
          </Field>
          <DialogFooter>
            <Button disabled={submitting} type="submit">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Submit proposal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Applies a consistent label to one proposal field.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
