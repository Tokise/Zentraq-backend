"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

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

export interface LineChartPoint {
  label: string
  value: number
}

interface ChartLineStepProps {
  data: LineChartPoint[]
  description?: string
  title: string
  valueLabel: string
}

// Renders a theme-adaptive step line for chronological clinic totals.
export function ChartLineStep({
  data,
  description,
  title,
  valueLabel,
}: ChartLineStepProps) {
  const config = {
    value: {
      label: valueLabel,
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No trend data is available.
          </div>
        ) : (
          <ChartContainer className="h-[280px] w-full" config={config}>
            <LineChart
              accessibilityLayer
              data={data}
              margin={{ left: 0, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                minTickGap={24}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis axisLine={false} allowDecimals={false} tickLine={false} />
              <ChartTooltip
                content={<ChartTooltipContent hideLabel />}
                cursor={false}
              />
              <Line
                dataKey="value"
                dot={false}
                stroke="var(--color-value)"
                strokeWidth={2}
                type="step"
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
