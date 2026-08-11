"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Power } from "lucide-react";
import { toast } from "sonner";

import {
  getMyClinicianDutyStatus,
  setMyClinicianDutyStatus,
  type ClinicianDutyStatus,
} from "@/actions/clinical/visits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Lets a Doctor publish an expiring on-duty state during their schedule.
export function DoctorDutyToggle() {
  const [status, setStatus] = useState<ClinicianDutyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Loads the current server-derived duty state.
  const loadStatus = useCallback(async () => {
    const result = await getMyClinicianDutyStatus();
    if (result.error) toast.error(result.error);
    setStatus(result.status);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadStatus]);

  // Changes duty state after schedule validation in PostgreSQL.
  async function changeStatus() {
    const nextOnDuty = !status?.isOnDuty;
    setSaving(true);
    const result = await setMyClinicianDutyStatus(nextOnDuty);
    setSaving(false);
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Unable to change duty status");
      return;
    }
    setStatus(result.data);
    toast.success(nextOnDuty ? "You are now available for reviews." : "You are now off duty.");
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock3 className="size-5" />
          </div>
          <div>
            <p className="font-medium">
              {status?.isOnDuty ? "Available for Nurse reviews" : "Not available for Nurse reviews"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status?.isOnDuty && status.expiresAt
                ? `Automatically expires ${new Date(status.expiresAt).toLocaleString()}.`
                : "You can go on duty only during an available schedule window."}
            </p>
          </div>
        </div>
        <Button
          disabled={loading || saving}
          onClick={() => void changeStatus()}
          type="button"
          variant={status?.isOnDuty ? "outline" : "default"}
        >
          <Power className="size-4" />
          {saving
            ? "Updating..."
            : status?.isOnDuty
              ? "Go off duty"
              : "Go on duty"}
        </Button>
      </CardContent>
    </Card>
  );
}
