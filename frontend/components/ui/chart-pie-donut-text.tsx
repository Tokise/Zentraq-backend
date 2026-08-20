"use client"

import * as React from "react"
import { Label, Pie, PieChart } from "recharts"

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

export interface DonutChartPoint {
  name: string
  value: number
}

interface ChartPieDonutTextProps {
  data: DonutChartPoint[]
  description?: string
  title: string
  totalLabel: string
}

// Renders a theme-adaptive donut with an accessible total and legend.
export function ChartPieDonutText({
  data,
  description,
  title,
  totalLabel,
}: ChartPieDonutTextProps) {
  const chartData = React.useMemo(
    () =>
      data.map((item, index) => ({
        ...item,
        key: `slice${index}`,
        fill: `var(--color-slice${index})`,
      })),
    [data],
  )
  const config = React.useMemo(() => {
    const next: ChartConfig = {
      value: { label: totalLabel },
    }
    chartData.forEach((item, index) => {
      next[item.key] = {
        label: item.name,
        color: `var(--chart-${(index % 5) + 1})`,
      }
    })
    return next
  }, [chartData, totalLabel])
  const total = React.useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data],
  )

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No distribution data is available.
          </div>
        ) : (
          <ChartContainer
            className="mx-auto aspect-square max-h-[280px]"
            config={config}
          >
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={<ChartTooltipContent hideLabel nameKey="key" />}
                cursor={false}
              />
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={58}
                nameKey="key"
                strokeWidth={4}
              >
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                      return null
                    }
                    return (
                      <text
                        dominantBaseline="middle"
                        textAnchor="middle"
                        x={viewBox.cx}
                        y={viewBox.cy}
                      >
                        <tspan
                          className="fill-foreground text-3xl font-bold"
                          x={viewBox.cx}
                          y={viewBox.cy}
                        >
                          {total.toLocaleString()}
                        </tspan>
                        <tspan
                          className="fill-muted-foreground text-xs"
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 22}
                        >
                          {totalLabel}
                        </tspan>
                      </text>
                    )
                  }}
                />
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="key" />}
                verticalAlign="bottom"
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
