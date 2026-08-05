import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export default function PasswordResetPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Password Reset" description="Manage Password Reset" />
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">This page is under construction.</p>
        </CardContent>
      </Card>
    </div>
  )
}
