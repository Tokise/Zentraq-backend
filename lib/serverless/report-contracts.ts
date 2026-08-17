import { z } from "zod"

export const reportRequestSchema = z
  .object({
    endDate: z.iso.date(),
    reportType: z.literal("clinic-aggregate"),
    startDate: z.iso.date(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message:
      "The report start date must not be after its end date.",
  })
  .refine(
    (value) => {
      const start = new Date(
        `${value.startDate}T00:00:00Z`,
      )
      const end = new Date(
        `${value.endDate}T00:00:00Z`,
      )
      return (
        end.getTime() - start.getTime() <=
        366 * 24 * 60 * 60 * 1000
      )
    },
    {
      message:
        "Reports are limited to 367 calendar days.",
    },
  )

export type ReportRequestV1 =
  z.infer<typeof reportRequestSchema>

export const reportRequestIdSchema = z.string().uuid()

export type ReportRequestStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
