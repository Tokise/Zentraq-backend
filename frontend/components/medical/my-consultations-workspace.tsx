"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, ClipboardList, Pill, Stethoscope } from "lucide-react"
import { toast } from "sonner"

import {
  getMyConsultationWorkspaceAction,
  type MyConsultationOverview,
  type MyConsultationRow,
  type MyConsultationTab,
} from "@/actions/clinical/records/my-consultations"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient as createBrowserClient } from "@/utils/supabase/client"

const tabs: Array<{ value: MyConsultationTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "history", label: "Consultation History" },
  { value: "prescriptions", label: "Prescriptions" },
  { value: "diagnoses", label: "Diagnoses & Treatments" },
  { value: "vitals", label: "Vitals" },
  { value: "follow-ups", label: "Follow-ups" },
]

const emptyOverview: MyConsultationOverview = {
  consultations: 0,
  prescriptions: 0,
  diagnosesAndTreatments: 0,
  vitals: 0,
  followUps: 0,
}

// Renders the shared read-only, server-paged personal consultation workspace.
export function MyConsultationsWorkspace() {
  const [supabase] = useState(() => createBrowserClient())
  const [tab, setTab] = useState<MyConsultationTab>("overview")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<MyConsultationRow[]>([])
  const [overview, setOverview] = useState(emptyOverview)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [patientTopic, setPatientTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MyConsultationRow | null>(null)

  // Loads one authorized tab page from the signed-in user's completed records.
  const loadPage = useCallback(
    async (requestedPage = page) => {
      setLoading(true)
      const result = await getMyConsultationWorkspaceAction({
        tab,
        page: requestedPage,
      })
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
        setRows([])
        return
      }
      setRows(result.rows)
      setOverview(result.overview)
      setTotal(result.total)
      setTotalPages(result.totalPages)
      setPatientTopic(result.patientTopic)
    },
    [page, tab],
  )

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadPage()
    }, 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadPage])

  // Reloads the active tab immediately after a private patient-record invalidation.
  useEffect(() => {
    if (!patientTopic) return
    let reloadTimer: number | undefined
    const channel = supabase.channel(patientTopic, {
      config: { private: true },
    })
    void supabase.realtime.setAuth().then(() => {
      channel
        .on("broadcast", { event: "patient-record-changed" }, () => {
          window.clearTimeout(reloadTimer)
          reloadTimer = window.setTimeout(() => {
            setPage(1)
            void loadPage(1)
          }, 100)
        })
        .subscribe()
    })
    return () => {
      window.clearTimeout(reloadTimer)
      void supabase.removeChannel(channel)
    }
  }, [loadPage, patientTopic, supabase])

  // Changes the active data tab and resets its server page.
  function changeTab(value: string) {
    setTab(value as MyConsultationTab)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Your completed consultations and resulting care records."
        title="My Consultations"
      />
      <Tabs onValueChange={changeTab} value={tab}>
        <TabsList className="max-w-full flex-wrap justify-start">
          {tabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewCards overview={overview} />
        </TabsContent>
        {tabs.slice(1).map((item) => (
          <TabsContent key={item.value} value={item.value}>
            <ConsultationTable
              loading={loading}
              rows={rows}
              tab={item.value}
              onSelect={setSelected}
            />
            <DataTablePagination
              className="mt-4"
              currentPage={page}
              onPageChange={setPage}
              pageSize={10}
              totalItems={total}
              totalPages={totalPages}
            />
          </TabsContent>
        ))}
      </Tabs>
      <ConsultationDetail row={selected} onOpenChange={() => setSelected(null)} />
    </div>
  )
}

// Summarizes the patient's completed consultation record counts.
function OverviewCards({ overview }: { overview: MyConsultationOverview }) {
  const cards = [
    { label: "Consultations", value: overview.consultations, icon: Stethoscope },
    { label: "Prescriptions", value: overview.prescriptions, icon: Pill },
    {
      label: "Diagnoses & Treatments",
      value: overview.diagnosesAndTreatments,
      icon: ClipboardList,
    },
    { label: "Vitals", value: overview.vitals, icon: Activity },
    { label: "Follow-ups", value: overview.followUps, icon: Stethoscope },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-sm">{card.label}</CardTitle>
              <Icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {card.value}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Renders one active tab as a deterministic page-size-10 table.
function ConsultationTable({
  loading,
  rows,
  tab,
  onSelect,
}: {
  loading: boolean
  rows: MyConsultationRow[]
  tab: MyConsultationTab
  onSelect: (row: MyConsultationRow) => void
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>{tabLabel(tab)}</TableHead>
              <TableHead>Clinician</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={`consultation-skeleton-${index}`}>
                  {Array.from({ length: 5 }, (_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-5 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={`${row.kind}:${row.id}`}>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    {row.summary && (
                      <p className="max-w-md truncate text-xs text-muted-foreground">
                        {row.summary}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p>{row.clinicianName}</p>
                    {row.clinicianRole && (
                      <p className="text-xs capitalize text-muted-foreground">
                        {row.clinicianRole}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.status ? (
                      <Badge className="capitalize" variant="outline">
                        {row.status.replaceAll("_", " ")}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => onSelect(row)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="py-16 text-center text-muted-foreground"
                  colSpan={5}
                >
                  No completed records in this section.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// Shows the selected minimized record without internal account or audit fields.
function ConsultationDetail({
  row,
  onOpenChange,
}: {
  row: MyConsultationRow | null
  onOpenChange: () => void
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onOpenChange()} open={Boolean(row)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row?.title ?? "Consultation detail"}</DialogTitle>
          <DialogDescription>
            {row ? `${formatDate(row.date)} · ${row.clinicianName}` : ""}
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-4 text-sm">
            {row.summary && <p className="whitespace-pre-wrap">{row.summary}</p>}
            {row.details.map((item) => (
              <div className="space-y-1" key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="whitespace-pre-wrap font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Resolves the main content heading for each clinical tab.
function tabLabel(tab: MyConsultationTab): string {
  if (tab === "history") return "Consultation"
  if (tab === "prescriptions") return "Medicine"
  if (tab === "diagnoses") return "Diagnosis / Treatment"
  if (tab === "vitals") return "Assessment"
  return "Follow-up"
}

// Formats a stored clinical timestamp in the user's current locale.
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
