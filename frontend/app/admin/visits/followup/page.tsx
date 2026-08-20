import Link from "next/link";
import { CalendarClock, ClipboardCheck, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

// Explains the secure, case-linked incident follow-up workflow.
export default function FollowupPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Coordinate follow-up care for active incident cases."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              How follow-ups work
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Follow-ups are attached to an incident so their clinical context and
            audit history remain together.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Schedule safely
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open a case, set its next review date, and include concise clinical
            instructions.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Review status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use the case-status view to monitor open and in-progress cases
            requiring attention.
          </CardContent>
        </Card>
      </div>
      <EmptyState
        title="Follow-ups are managed from incident cases"
        description="Open an incident to schedule or review its follow-up details. This keeps follow-up activity connected to the original emergency record."
        icon={CalendarClock}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link className={buttonVariants()} href="/admin/incidents/log">
              Open Incident Log <ExternalLink className="size-4" />
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/admin/incidents/status"
            >
              View Case Status <ClipboardCheck className="size-4" />
            </Link>
          </div>
        }
      />
    </div>
  );
}
