import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type StatCardProps = {
  label: string
  value: string | number
  change?: number
  className?: string
}

export function StatCard({ label, value, change, className }: StatCardProps) {
  const changeLabel =
    change !== undefined
      ? `${change >= 0 ? "+" : ""}${change}%`
      : null

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          {changeLabel && (
            <span
              className={cn(
                "text-xs font-medium",
                change! >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {changeLabel}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
