import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"

export default function ViewOnlyPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="View Only" description="Manage View Only" />
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">This page is under construction.</p>
        </CardContent>
      </Card>
    </div>
  )
}
