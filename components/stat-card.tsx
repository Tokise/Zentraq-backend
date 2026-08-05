import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: number
  comparisonText?: string
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  comparisonText,
  className,
}: StatCardProps) {
  const hasTrend = trend !== undefined

  return (
    <div className={cn("border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        {Icon && (
          <div className="flex size-9 shrink-0 items-center justify-center border border-primary/20 bg-primary-soft text-primary">
            <Icon className="size-4" />
          </div>
        )}
      </div>

      {(hasTrend || comparisonText) && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3">
          {hasTrend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                trend! >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {trend! >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {trend! >= 0 ? "+" : ""}
              {trend}%
            </span>
          )}
          {comparisonText && (
            <span className="text-xs text-muted-foreground">{comparisonText}</span>
          )}
        </div>
      )}
    </div>
  )
}