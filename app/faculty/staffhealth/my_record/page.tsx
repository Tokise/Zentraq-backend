"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Heart } from "lucide-react"
import { toast } from "sonner"
import { getOwnMedicalRecord } from "@/actions/clinical/records"

// Converts structured allergy data into readable patient-facing text.
function formatAllergies(allergies: unknown): string {
  if (!Array.isArray(allergies)) return typeof allergies === "string" ? allergies : "None"
  if (allergies.length === 0) return "None"
  return allergies
    .map((allergy) => {
      if (!allergy || typeof allergy !== "object") return ""
      const item = allergy as { allergen?: string; severity?: string | null }
      return item.severity ? `${item.allergen ?? "Unknown"} (${item.severity})` : item.allergen ?? "Unknown"
    })
    .filter(Boolean)
    .join(", ") || "None"
}

export default function FacultyStaffHealthMyRecordPage() {
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOwnMedicalRecord()
      if (res.error) {
        toast.error(res.error)
        setRecord(null)
      } else {
        setRecord(res.record)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load staff health record")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader title="My Health Record" description="Your staff health record." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !record ? (
            <div className="py-16 text-center">
              <Heart className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No health record found.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-zinc-500">Blood Type</p>
                    <p className="font-medium">{record.blood_type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Height</p>
                    <p className="font-medium">{record.height ? `${record.height} cm` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Weight</p>
                    <p className="font-medium">{record.weight ? `${record.weight} kg` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Allergies</p>
                    <p className="font-medium">{formatAllergies(record.allergies)}</p>
                  </div>
                </div>
                {record.chronic_conditions && (
                  <div className="mt-3">
                    <p className="text-xs text-zinc-500">Chronic Conditions</p>
                    <p className="text-sm">{record.chronic_conditions}</p>
                  </div>
                )}
                {record.current_medications && (
                  <div className="mt-2">
                    <p className="text-xs text-zinc-500">Current Medications</p>
                    <p className="text-sm">{record.current_medications}</p>
                  </div>
                )}
              </div>

              {record.visits && record.visits.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Recent Visits</h3>
                  <div className="space-y-2">
                    {record.visits.slice(0, 5).map((visit: any) => (
                      <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200">
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(visit.check_in_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="text-xs text-zinc-500">{visit.visit_type}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">{visit.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
