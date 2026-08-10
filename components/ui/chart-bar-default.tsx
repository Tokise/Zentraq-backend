"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

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

export interface BarChartPoint {
  label: string
  value: number
}

interface ChartBarDefaultProps {
  data: BarChartPoint[]
  description?: string
  title: string
  valueLabel: string
}

const chartConfig = {
  value: {
    label: "Count",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

// Renders a theme-adaptive categorical bar chart from real clinic totals.
export function ChartBarDefault({
  data,
  description,
  title,
  valueLabel,
}: ChartBarDefaultProps) {
  const config = {
    ...chartConfig,
    value: { ...chartConfig.value, label: valueLabel },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ChartContainer className="h-[300px] w-full" config={config}>
            <BarChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                interval={0}
                tickLine={false}
                tickMargin={8}
                type="category"
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                type="number"
                width={36}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={false}
              />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Shows a consistent empty state inside chart cards.
function ChartEmptyState() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      No chart data is available.
    </div>
  )
}
