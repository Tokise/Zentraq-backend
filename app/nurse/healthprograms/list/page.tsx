import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"

export default function ListPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="List" description="Manage List" />
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">This page is under construction.</p>
        </CardContent>
      </Card>
    </div>
  )
}
