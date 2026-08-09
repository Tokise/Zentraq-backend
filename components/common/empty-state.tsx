import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  title: string
  description: string
  icon?: LucideIcon
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center border border-dashed border-border bg-card px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-3 flex size-10 items-center justify-center border border-border bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}