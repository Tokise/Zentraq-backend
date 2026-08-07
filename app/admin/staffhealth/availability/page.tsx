"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getStaffAvailabilityAction, upsertStaffAvailability, deleteStaffAvailability, getClinicStaffForAvailability } from "@/actions/admin/staff-availability"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function AdminStaffAvailabilityPage() {
  const [availability, setAvailability] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    id: "",
    clinic_account_id: "",
    day_of_week: 1,
    start_time: "08:00",
    end_time: "17:00",
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [availRes, staffRes] = await Promise.all([getStaffAvailabilityAction(), getClinicStaffForAvailability()])
      if (availRes.error) toast.error(availRes.error)
      else setAvailability(availRes.availability)
      if (staffRes.error) toast.error(staffRes.error)
      else setStaffList(staffRes.staff)
    } catch (err: any) {
      toast.error(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clinic_account_id) {
      toast.error("Please select a staff member")
      return
    }
    setSubmitting(true)
    try {
      const res = await upsertStaffAvailability({
        id: form.id || undefined,
        clinic_account_id: form.clinic_account_id,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
      })
      if (res.error) toast.error(res.error)
      else {
        toast.success(form.id ? "Availability updated" : "Availability added")
        setForm({ id: "", clinic_account_id: "", day_of_week: 1, start_time: "08:00", end_time: "17:00" })
        fetchData()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save availability")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(row: any) {
    setForm({
      id: row.id,
      clinic_account_id: row.clinic_account_id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
    })
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this availability slot?")) return
    try {
      const res = await deleteStaffAvailability(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Availability deleted")
        fetchData()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Availability" description="Manage doctor and nurse weekly schedules for appointment assignment." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-1">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4">{form.id ? "Edit Slot" : "Add Availability"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Staff Member</Label>
                <select
                  value={form.clinic_account_id}
                  onChange={(e) => setForm({ ...form, clinic_account_id: e.target.value })}
                  className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                >
                  <option value="">Select staff</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Day of Week</Label>
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                  className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Time</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Time</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="h-9" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1 cursor-pointer">
                  {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5 mr-1" />}
                  {form.id ? "Update" : "Add"}
                </Button>
                {form.id && (
                  <Button type="button" variant="outline" onClick={() => setForm({ id: "", clinic_account_id: "", day_of_week: 1, start_time: "08:00", end_time: "17:00" })}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : availability.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">No availability slots configured.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Staff</th>
                      <th className="px-4 py-3 font-medium">Day</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {availability.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-medium">{row.staff_name}</td>
                        <td className="px-4 py-3">{DAYS[row.day_of_week] || row.day_of_week}</td>
                        <td className="px-4 py-3 text-zinc-600">{row.start_time.slice(0, 5)} - {row.end_time.slice(0, 5)}</td>
                        <td className="px-4 py-3 capitalize">
                          <Badge variant="outline" className="text-[10px]">{row.role}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => handleEdit(row)}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600" onClick={() => handleDelete(row.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}