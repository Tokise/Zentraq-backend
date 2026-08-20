"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"

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

export interface RadarChartPoint {
  label: string
  value: number
}

interface ChartRadarDotsProps {
  data: RadarChartPoint[]
  description?: string
  title: string
  valueLabel: string
}

// Renders a theme-adaptive radar comparison for clinic activity channels.
export function ChartRadarDots({
  data,
  description,
  title,
  valueLabel,
}: ChartRadarDotsProps) {
  const config = {
    value: {
      label: valueLabel,
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pb-4">
        {data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No comparison data is available.
          </div>
        ) : (
          <ChartContainer
            className="mx-auto aspect-square max-h-[280px]"
            config={config}
          >
            <RadarChart accessibilityLayer data={data}>
              <ChartTooltip
                content={<ChartTooltipContent hideLabel />}
                cursor={false}
              />
              <PolarAngleAxis dataKey="label" />
              <PolarGrid />
              <Radar
                dataKey="value"
                dot={{ fillOpacity: 1, r: 4 }}
                fill="var(--color-value)"
                fillOpacity={0.45}
                stroke="var(--color-value)"
              />
            </RadarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
