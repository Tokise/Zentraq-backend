import type { AreaChartSeries } from "@/components/ui/chart-area-interactive"

export const clinicalActivitySeries = [
  {
    color: "var(--foreground)",
    key: "total_consultations",
    label: "Total consultations",
  },
  {
    color: "var(--chart-1)",
    key: "student_consultations",
    label: "Student consultations",
  },
  {
    color: "var(--chart-2)",
    key: "faculty_consultations",
    label: "Faculty consultations",
  },
  {
    color: "var(--chart-3)",
    key: "walk_in_visits",
    label: "Walk-in visits",
  },
  {
    color: "var(--chart-4)",
    key: "appointment_visits",
    label: "Appointment visits",
  },
  {
    color: "var(--chart-5)",
    key: "rfid_visits",
    label: "RFID visits",
  },
] satisfies readonly AreaChartSeries[]
