import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"

type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Coming soon"
        description={`The ${title} module will be available in a future release.`}
      />
    </div>
  )
}
