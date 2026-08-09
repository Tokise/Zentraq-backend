"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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

export interface AreaChartPoint {
  date: string
  primary: number
  secondary: number
}

interface ChartAreaInteractiveProps {
  data: AreaChartPoint[]
  description: string
  primaryLabel: string
  secondaryLabel: string
  title: string
}

type TimeRange = "90d" | "30d" | "7d"

// Renders a theme-adaptive activity area chart with a bounded date selector.
export function ChartAreaInteractive({
  data,
  description,
  primaryLabel,
  secondaryLabel,
  title,
}: ChartAreaInteractiveProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("90d")
  const gradientId = React.useId().replaceAll(":", "")

  const chartConfig = React.useMemo(
    () =>
      ({
        primary: {
          label: primaryLabel,
          color: "var(--chart-1)",
        },
        secondary: {
          label: secondaryLabel,
          color: "var(--chart-2)",
        },
      }) satisfies ChartConfig,
    [primaryLabel, secondaryLabel],
  )

  const filteredData = React.useMemo(() => {
    if (data.length === 0) return []

    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
    const referenceDate = new Date(`${sorted.at(-1)?.date}T00:00:00`)
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - days + 1)

    return sorted.filter(
      (item) => new Date(`${item.date}T00:00:00`) >= startDate,
    )
  }, [data, timeRange])

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
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No activity is available for this period.
          </div>
        ) : (
          <ChartContainer
            className="aspect-auto h-[250px] w-full"
            config={chartConfig}
          >
            <AreaChart accessibilityLayer data={filteredData}>
              <defs>
                <linearGradient
                  id={`${gradientId}-primary`}
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0.75}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0.08}
                  />
                </linearGradient>
                <linearGradient
                  id={`${gradientId}-secondary`}
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-secondary)"
                    stopOpacity={0.65}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-secondary)"
                    stopOpacity={0.06}
                  />
                </linearGradient>
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
              <Area
                dataKey="secondary"
                fill={`url(#${gradientId}-secondary)`}
                stroke="var(--color-secondary)"
                type="natural"
              />
              <Area
                dataKey="primary"
                fill={`url(#${gradientId}-primary)`}
                stroke="var(--color-primary)"
                type="natural"
              />
              <ChartLegend content={<ChartLegendContent />} />
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
