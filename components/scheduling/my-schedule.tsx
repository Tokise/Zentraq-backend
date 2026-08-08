"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  addScheduleBlockAction,
  getMyScheduleAction,
  saveAvailabilityAction,
} from "@/actions/scheduling/my-schedule";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Manages recurring clinician availability and date-specific unavailability.
export function MySchedulePage() {
  const [data, setData] = useState<any>({
    availability: [],
    blocks: [],
    clinicians: [],
  });
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState({
    clinic_account_id: "",
    day_of_week: "1",
    start_time: "08:00",
    end_time: "12:00",
  });
  const [block, setBlock] = useState({
    clinic_account_id: "",
    blocked_date: "",
    start_time: "08:00",
    end_time: "17:00",
    reason: "",
  });

  // Loads the role-scoped schedule information.
  const load = useCallback(async () => {
    setLoading(true);
    const result = await getMyScheduleAction();
    setLoading(false);
    if (result.error) return toast.error(result.error);
    setData(result);
    if (result.clinicians.length === 1) {
      setAvailability((value) => ({
        ...value,
        clinic_account_id: result.clinicians[0].id,
      }));
      setBlock((value) => ({
        ...value,
        clinic_account_id: result.clinicians[0].id,
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Adds a recurring availability window.
  async function saveAvailability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await saveAvailabilityAction({
      ...availability,
      day_of_week: Number(availability.day_of_week),
    });
    if (result.error) return toast.error(result.error);
    toast.success("Availability saved");
    await load();
  }

  // Adds a date-specific unavailable range.
  async function saveBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addScheduleBlockAction(block);
    if (result.error) return toast.error(result.error);
    toast.success("Time blocked");
    setBlock((value) => ({ ...value, blocked_date: "", reason: "" }));
    await load();
  }

  const isAdmin = data.clinicians.length > 0;
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Schedule"
        description="Published availability is the basis for patient appointment times."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold">Weekly availability</h2>
            <form className="mt-4 space-y-3" onSubmit={saveAvailability}>
              {isAdmin && (
                <ClinicianSelect
                  clinicians={data.clinicians}
                  onChange={(clinic_account_id) =>
                    setAvailability((value) => ({
                      ...value,
                      clinic_account_id,
                    }))
                  }
                  value={availability.clinic_account_id}
                />
              )}
              <label className="block text-sm">
                Day
                <select
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                  onChange={(event) =>
                    setAvailability((value) => ({
                      ...value,
                      day_of_week: event.target.value,
                    }))
                  }
                  value={availability.day_of_week}
                >
                  {DAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <TimeInputs
                end={availability.end_time}
                onEndChange={(end_time) =>
                  setAvailability((value) => ({ ...value, end_time }))
                }
                onStartChange={(start_time) =>
                  setAvailability((value) => ({ ...value, start_time }))
                }
                start={availability.start_time}
              />
              <Button type="submit">
                <Plus className="mr-1 size-4" />
                Publish time
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold">Block a date</h2>
            <form className="mt-4 space-y-3" onSubmit={saveBlock}>
              {isAdmin && (
                <ClinicianSelect
                  clinicians={data.clinicians}
                  onChange={(clinic_account_id) =>
                    setBlock((value) => ({ ...value, clinic_account_id }))
                  }
                  value={block.clinic_account_id}
                />
              )}
              <div>
                <Label htmlFor="block-date">Date</Label>
                <Input
                  id="block-date"
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) =>
                    setBlock((value) => ({
                      ...value,
                      blocked_date: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={block.blocked_date}
                />
              </div>
              <TimeInputs
                end={block.end_time}
                onEndChange={(end_time) =>
                  setBlock((value) => ({ ...value, end_time }))
                }
                onStartChange={(start_time) =>
                  setBlock((value) => ({ ...value, start_time }))
                }
                start={block.start_time}
              />
              <div>
                <Label htmlFor="block-reason">Reason</Label>
                <Input
                  id="block-reason"
                  onChange={(event) =>
                    setBlock((value) => ({
                      ...value,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Leave, meeting, emergency"
                  value={block.reason}
                />
              </div>
              <Button type="submit" variant="outline">
                <CalendarOff className="mr-1 size-4" />
                Block time
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold">Published schedule</h2>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {data.availability.map((item: any) => (
                <div className="border border-border p-3" key={item.id}>
                  <p className="font-medium">
                    {item.clinic_accounts?.display_name ?? "My schedule"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {DAYS[item.day_of_week]} · {item.start_time.slice(0, 5)}–
                    {item.end_time.slice(0, 5)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <h3 className="mt-6 font-semibold">Upcoming blocked times</h3>
          <div className="mt-3 space-y-2">
            {data.blocks.map((item: any) => (
              <div className="border border-border p-3" key={item.id}>
                <p className="font-medium">
                  {item.blocked_date} · {item.start_time.slice(0, 5)}–
                  {item.end_time.slice(0, 5)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.reason || "Unavailable"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Renders the admin-only clinician target selector.
function ClinicianSelect({
  clinicians,
  onChange,
  value,
}: {
  clinicians: Array<{ id: string; display_name: string; role: string }>;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block text-sm">
      Clinician
      <select
        className="mt-1 h-9 w-full rounded-md border bg-background px-2"
        onChange={(event) => onChange(event.target.value)}
        required
        value={value}
      >
        <option value="">Select clinician</option>
        {clinicians.map((clinician) => (
          <option key={clinician.id} value={clinician.id}>
            {clinician.display_name} ({clinician.role})
          </option>
        ))}
      </select>
    </label>
  );
}

// Renders paired time inputs for a schedule range.
function TimeInputs({
  end,
  onEndChange,
  onStartChange,
  start,
}: {
  end: string;
  onEndChange: (value: string) => void;
  onStartChange: (value: string) => void;
  start: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="schedule-start">Start</Label>
        <Input
          id="schedule-start"
          onChange={(event) => onStartChange(event.target.value)}
          required
          type="time"
          value={start}
        />
      </div>
      <div>
        <Label htmlFor="schedule-end">End</Label>
        <Input
          id="schedule-end"
          onChange={(event) => onEndChange(event.target.value)}
          required
          type="time"
          value={end}
        />
      </div>
    </div>
  );
}
