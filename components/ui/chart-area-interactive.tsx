"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface AreaChartPoint {
  date: string
  [key: string]: number | string
}

export interface AreaChartSeries {
  color: string
  key: string
  label: string
}

interface ChartAreaInteractiveProps {
  data: AreaChartPoint[]
  description: string
  series: readonly AreaChartSeries[]
  title: string
}

type TimeRange = "90d" | "30d" | "7d"

// Renders a multi-series activity area chart with a bounded date selector.
export function ChartAreaInteractive({
  data,
  description,
  series,
  title,
}: ChartAreaInteractiveProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("90d")
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(
    () => new Set(),
  )
  const gradientId = React.useId().replaceAll(":", "")

  const chartConfig = React.useMemo(
    () =>
      Object.fromEntries(
        series.map((item) => [
          item.key,
          { color: item.color, label: item.label },
        ]),
      ) as ChartConfig,
    [series],
  )

  const filteredData = React.useMemo(() => {
    if (data.length === 0) return []

    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
    const referenceDate = new Date()
    referenceDate.setHours(0, 0, 0, 0)
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - days + 1)

    return sorted.filter((item) => {
      const itemDate = new Date(`${item.date}T00:00:00`)
      return itemDate >= startDate && itemDate <= referenceDate
    })
  }, [data, timeRange])

  // Toggles one metric while retaining at least one visible series.
  function toggleSeries(key: string) {
    setHiddenKeys((current) => {
      const visibleCount = series.filter(
        (item) => !current.has(item.key),
      ).length
      if (!current.has(key) && visibleCount === 1) return current

      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Select
          onValueChange={(value) => value && setTimeRange(value as TimeRange)}
          value={timeRange}
        >
          <SelectTrigger
            aria-label="Select chart period"
            className="w-36 rounded-lg sm:ml-auto"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem className="rounded-lg" value="90d">
              Last 90 days
            </SelectItem>
            <SelectItem className="rounded-lg" value="30d">
              Last 30 days
            </SelectItem>
            <SelectItem className="rounded-lg" value="7d">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4 px-2 pt-4 sm:px-6 sm:pt-6">
        <div
          aria-label="Chart series"
          className="flex flex-wrap gap-2"
          role="group"
        >
          {series.map((item) => {
            const visible = !hiddenKeys.has(item.key)
            return (
              <button
                aria-pressed={visible}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  visible
                    ? "border-border bg-muted text-foreground"
                    : "border-transparent bg-muted/40 text-muted-foreground",
                )}
                key={item.key}
                onClick={() => toggleSeries(item.key)}
                type="button"
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </button>
            )
          })}
        </div>

        {filteredData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No activity is available for this period.
          </div>
        ) : (
          <ChartContainer
            className="aspect-auto h-[280px] w-full"
            config={chartConfig}
          >
            <AreaChart accessibilityLayer data={filteredData}>
              <defs>
                {series.map((item) => (
                  <linearGradient
                    id={`${gradientId}-${item.key}`}
                    key={item.key}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={item.color}
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor={item.color}
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="date"
                minTickGap={32}
                tickFormatter={formatChartDate}
                tickLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(value) => formatChartDate(String(value))}
                  />
                }
                cursor={false}
              />
              {series.map((item) =>
                !hiddenKeys.has(item.key) ? (
                  <Area
                    dataKey={item.key}
                    fill={`url(#${gradientId}-${item.key})`}
                    key={item.key}
                    stroke={item.color}
                    type="natural"
                  />
                ) : null,
              )}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Formats an ISO date for compact chart axes and tooltips.
function formatChartDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    },
  )
}
