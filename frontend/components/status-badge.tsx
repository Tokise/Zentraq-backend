import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  status: "success" | "warning" | "danger" | "info" | "default"
  children: React.ReactNode
  className?: string
}

const statusStyles = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
  default: "bg-muted text-muted-foreground border-border",
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md border", statusStyles[status], className)}
    >
      {children}
    </Badge>
  )
}
