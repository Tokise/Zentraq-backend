"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getHealthPrograms,
  type HealthProgram,
} from "@/actions/inventory/health-programs";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";

// Formats optional program dates for concise schedule rows.
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Not scheduled";

// Displays scheduled health programs using the existing program service.
export default function SchedulePage() {
  const [programs, setPrograms] = useState<HealthProgram[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getHealthPrograms()
      .then((result) => {
        if (result.error) toast.error(result.error);
        else setPrograms(result.programs);
      })
      .catch(() => toast.error("Failed to load program schedule"))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Schedule"
        description="Review the planned dates and availability of school health programs."
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : programs.length === 0 ? (
            <EmptyState
              className="border-0"
              title="No programs scheduled"
              description="Create a health program with start and end dates to see it here."
              icon={CalendarDays}
            />
          ) : (
            <div className="divide-y divide-border">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{program.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {date(program.start_date)} — {date(program.end_date)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {program.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
