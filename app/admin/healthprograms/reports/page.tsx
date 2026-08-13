"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getHealthProgramsAction,
  type HealthProgram,
} from "@/actions/health-programs/management";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

// Lists existing programs that are available for clinic reporting.
export default function ReportsPage() {
  const [programs, setPrograms] = useState<HealthProgram[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getHealthProgramsAction()
      .then((result) => {
        if (result.error) toast.error(result.error);
        else setPrograms(result.programs);
      })
      .catch(() => toast.error("Failed to load health programs"))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Reports"
        description="Review the programs available for monitoring and use clinic reports for compliant exports."
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : programs.length === 0 ? (
        <EmptyState
          title="No program data available"
          description="Program reporting becomes available after a health program is created."
          icon={BarChart3}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardHeader>
                <CardTitle className="text-base">{program.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="min-h-10 text-sm text-muted-foreground">
                  {program.description || "No program description provided."}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {program.program_type} ·{" "}
                  {program.is_active ? "Active" : "Inactive"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Clinic reporting and exports</p>
            <p className="text-sm text-muted-foreground">
              Generate consolidated clinic reports using existing reporting
              tools.
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/admin/reports/generate"
          >
            Open Reports & Analytics
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
