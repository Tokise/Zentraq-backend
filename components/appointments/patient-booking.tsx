"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Clock3, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import {
  getAppointmentCliniciansAction,
  getAppointmentAvailabilityAction,
} from "@/actions/patient/portal";
import { submitAppointmentRequest } from "@/actions/scheduling/appointments";
import { PageHeader } from "@/components/common/page-header";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

type Clinician = {
  id: string;
  name: string;
  role: "doctor" | "nurse";
  weeklyAvailability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
};

type Slot = {
  clinician_id: string;
  clinician_name: string;
  clinician_role: string;
  scheduled_date: string;
  scheduled_time: string;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Renders a patient-safe clinician-first appointment booking flow.
export function PatientBookingPage() {
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [selectedClinician, setSelectedClinician] = useState<Clinician | null>(
    null,
  );
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [date, setDate] = useState("");
  const [minBookableDate, setMinBookableDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingClinicians, setLoadingClinicians] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState("");

  // Loads published clinician schedules when the booking form first opens.
  useEffect(() => {
    async function loadClinicians() {
      const result = await getAppointmentCliniciansAction();
      setLoadingClinicians(false);
      setMinBookableDate(result.minBookableDate ?? "");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setClinicians(result.clinicians as Clinician[]);
    }
    void loadClinicians();
  }, []);

  // Loads only one clinician's real-time slots for the selected modal date.
  const loadSlots = useCallback(
    async (clinicianId: string, selectedDate: string) => {
      if (!clinicianId || !selectedDate) return;
      setLoadingSlots(true);
      const result = await getAppointmentAvailabilityAction({
        clinicianId,
        selectedDate,
      });
      setLoadingSlots(false);
      if (result.error) {
        toast.error(result.error);
        setSlots([]);
        return;
      }
      setSlots(result.availability as Slot[]);
    },
    [],
  );

  // Opens one clinician's modal and defaults it to the first valid future date.
  function openClinicianSchedule(clinician: Clinician) {
    const firstDate = date || minBookableDate;
    setSelectedClinician(clinician);
    setSelectedSlot(null);
    setDate(firstDate);
    if (firstDate) void loadSlots(clinician.id, firstDate);
  }

  // Updates the slot grid after a future date is chosen in the clinician modal.
  function changeDate(nextDate: string) {
    setDate(nextDate);
    setSelectedSlot(null);
    if (selectedClinician) void loadSlots(selectedClinician.id, nextDate);
  }

  // Confirms a selected slot while safely recovering from a concurrent booking.
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot || !reason.trim()) {
      toast.error(
        "Choose a clinician time and enter a reason for your appointment.",
      );
      return;
    }
    setSubmitting(true);
    const result = await submitAppointmentRequest({
      doctor_id: selectedSlot.clinician_id,
      reason: reason.trim(),
      symptoms: symptoms.trim() || undefined,
      scheduled_date: selectedSlot.scheduled_date,
      scheduled_time: `${selectedSlot.scheduled_time}:00`,
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Appointment confirmed.");
      setReason("");
      setSymptoms("");
      setSelectedSlot(null);
      setSelectedClinician(null);
      return;
    }
    toast.error(result.error || "Unable to book that appointment.");
    if (result.code === "SLOT_TAKEN" && selectedClinician) {
      setSelectedSlot(null);
      await loadSlots(selectedClinician.id, date);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book Appointment"
        description="Choose a clinician, then select one available 30-minute time."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Choose a clinician</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClinicians ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : clinicians.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No clinician schedules are currently published.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {clinicians.map((clinician) => (
                  <button
                    className={`rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedSlot?.clinician_id === clinician.id ? "border-primary bg-muted" : "border-border bg-field"}`}
                    key={clinician.id}
                    onClick={() => openClinicianSchedule(clinician)}
                    type="button"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <Stethoscope className="size-4 text-primary" />
                      {clinician.name}
                    </span>
                    <span className="mt-1 block text-sm capitalize text-muted-foreground">
                      {clinician.role}
                    </span>
                    <span className="mt-3 block text-xs text-muted-foreground">
                      {weeklySummary(clinician.weeklyAvailability)}
                    </span>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      <Clock3 className="size-3.5" />
                      Choose time
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Appointment details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Selected time</p>
                <p className="mt-1 font-medium">
                  {selectedSlot
                    ? `${selectedSlot.clinician_name} · ${formatSlot(selectedSlot)}`
                    : "No time selected"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appointment-reason">Reason</Label>
                <Input
                  id="appointment-reason"
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Annual physical, headache, follow-up"
                  required
                  value={reason}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appointment-symptoms">Symptoms</Label>
                <Textarea
                  id="appointment-symptoms"
                  onChange={(event) => setSymptoms(event.target.value)}
                  placeholder="Optional"
                  rows={4}
                  value={symptoms}
                />
              </div>
              <Button disabled={submitting || !selectedSlot} type="submit">
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarPlus className="size-4" />
                )}
                Confirm appointment
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedClinician)}
        onOpenChange={(open) => !open && setSelectedClinician(null)}
      >
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedClinician?.name ?? "Clinician"} schedule
            </DialogTitle>
            <DialogDescription>
              Select a future date, then one available time. Only this
              clinician’s slots are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="slot-date">Appointment date</Label>
              <Calendar
                id="slot-date"
                min={minBookableDate}
                onSelect={changeDate}
                selected={date}
              />
            </div>
            <div>
              <h3 className="font-medium">Available 30-minute times</h3>
              {loadingSlots ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : slots.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">
                  No times remain on this date. Choose another future date.
                </p>
              ) : (
                <ScrollArea className="mt-3 max-h-72">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {slots.map((slot) => (
                      <Button
                        key={slot.scheduled_time}
                        onClick={() => setSelectedSlot(slot)}
                        type="button"
                        variant={
                          selectedSlot?.scheduled_time === slot.scheduled_time
                            ? "default"
                            : "outline"
                        }
                      >
                        {slot.scheduled_time}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
            {selectedSlot && (
              <Button
                className="w-full"
                onClick={() => setSelectedClinician(null)}
                type="button"
              >
                Use {formatSlot(selectedSlot)}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Formats a compact weekly schedule summary for a clinician card.
function weeklySummary(windows: Clinician["weeklyAvailability"]) {
  return windows
    .map(
      (window) =>
        `${weekdays[window.dayOfWeek]} ${window.startTime}–${window.endTime}`,
    )
    .join(" · ");
}

// Formats one selected slot for the booking summary.
function formatSlot(slot: Slot) {
  return `${new Date(`${slot.scheduled_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} at ${slot.scheduled_time}`;
}
