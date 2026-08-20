import type { DashboardActivityScope } from "@/actions/dashboard/queries"
import type { AreaChartSeries } from "@/components/ui/chart-area-interactive"

interface ClinicalActivityPresentation {
  description: string
  series: readonly AreaChartSeries[]
  title: string
}

const activityPresentations: Record<
  DashboardActivityScope,
  ClinicalActivityPresentation
> = {
  admin: {
    title: "My Admin Clinical Workflow",
    description:
      "Only consultations, appointments, prescriptions, and clearance work " +
      "assigned to your Admin account.",
    series: [
      {
        color: "var(--chart-1)",
        key: "assigned_consultations",
        label: "Assigned consultations",
      },
      {
        color: "var(--chart-2)",
        key: "completed_consultations",
        label: "Completed consultations",
      },
      {
        color: "var(--chart-3)",
        key: "scheduled_appointments",
        label: "Scheduled appointments",
      },
      {
        color: "var(--chart-4)",
        key: "prescriptions_written",
        label: "Prescriptions written",
      },
      {
        color: "var(--chart-5)",
        key: "clearance_evaluations",
        label: "Clearance evaluations",
      },
    ],
  },
  doctor: {
    title: "My Clinical Workflow",
    description:
      "Your assigned consultations, appointments, prescriptions, and clearance work over time.",
    series: [
      {
        color: "var(--chart-1)",
        key: "assigned_consultations",
        label: "Assigned consultations",
      },
      {
        color: "var(--chart-2)",
        key: "completed_consultations",
        label: "Completed consultations",
      },
      {
        color: "var(--chart-3)",
        key: "scheduled_appointments",
        label: "Scheduled appointments",
      },
      {
        color: "var(--chart-4)",
        key: "prescriptions_written",
        label: "Prescriptions written",
      },
      {
        color: "var(--chart-5)",
        key: "clearance_evaluations",
        label: "Clearance evaluations",
      },
    ],
  },
  nurse: {
    title: "My Nursing Workflow",
    description:
      "Your assigned consultations, completed cases, triage assessments, and patient check-ins over time.",
    series: [
      {
        color: "var(--chart-1)",
        key: "assigned_consultations",
        label: "Assigned consultations",
      },
      {
        color: "var(--chart-2)",
        key: "completed_consultations",
        label: "Completed consultations",
      },
      {
        color: "var(--chart-3)",
        key: "triage_assessments",
        label: "Triage assessments",
      },
      {
        color: "var(--chart-4)",
        key: "patient_check_ins",
        label: "Patient check-ins",
      },
    ],
  },
}

// Returns labels and series that match the server-authorized dashboard scope.
export function getClinicalActivityPresentation(
  scope: DashboardActivityScope,
): ClinicalActivityPresentation {
  return activityPresentations[scope]
}
