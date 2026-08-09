import Link from "next/link";
import { CheckCircle2, ShieldCheck, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

// Guides administrators to the existing controlled account provisioning workflow.
export default function ApprovalPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Approval"
        description="Review account-access controls and direct staff to the approved registration workflow."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Controlled registration
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            New accounts are created through the protected RFID registration
            workflow.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Access roles</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Assign only the roles and permissions required for clinic work.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Auditability</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use Activity Logs to review account and permission activity.
          </CardContent>
        </Card>
      </div>
      <EmptyState
        title="No separate approval queue is available"
        description="The existing system provisions accounts through secure registration. A dedicated approval state is not currently stored, so no approval action is shown here."
        icon={ShieldCheck}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link className={buttonVariants()} href="/admin/rfid-registration">
              Register Account <UserPlus className="size-4" />
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/admin/useraccess/roles"
            >
              Manage Roles <CheckCircle2 className="size-4" />
            </Link>
          </div>
        }
      />
    </div>
  );
}
