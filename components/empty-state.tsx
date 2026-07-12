import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  title: string
  description: string
  className?: string
}

export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
