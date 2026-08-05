import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export default function ParticipantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Participants" description="Manage Participants" />
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">This page is under construction.</p>
        </CardContent>
      </Card>
    </div>
  )
}
