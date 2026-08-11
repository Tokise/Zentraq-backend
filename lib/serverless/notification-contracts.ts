import { z } from "zod"

export const notificationTemplateKeys = [
  "appointment.updated",
  "clearance.updated",
  "inventory.attention",
  "system.notice",
] as const

export type NotificationTemplateKey =
  (typeof notificationTemplateKeys)[number]

export const notificationJobInputSchema = z
  .object({
    entityId: z.string().uuid().optional(),
    entityType: z
      .enum(["appointment", "clearance", "inventory", "system"])
      .optional(),
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
    receiverId: z.string().uuid(),
    templateKey: z.enum(notificationTemplateKeys),
  })
  .superRefine((value, context) => {
    const expectedType = value.templateKey.split(".")[0]
    const isSystemNotice = value.templateKey === "system.notice"
    if (Boolean(value.entityId) !== Boolean(value.entityType)) {
      context.addIssue({
        code: "custom",
        message: "Notification entity fields must be supplied together.",
      })
    }
    if (value.entityType && value.entityType !== expectedType) {
      context.addIssue({
        code: "custom",
        message: "Notification template and entity types must match.",
      })
    }
    if (!isSystemNotice && (!value.entityId || !value.entityType)) {
      context.addIssue({
        code: "custom",
        message: "Workflow notifications require an entity reference.",
      })
    }
  })

export type NotificationJobInput = z.infer<
  typeof notificationJobInputSchema
>

export const notificationTemplates: Record<
  NotificationTemplateKey,
  { message: string; title: string; type: string }
> = {
  "appointment.updated": {
    message: "An appointment update is available in Zentraq.",
    title: "Appointment update",
    type: "appointment",
  },
  "clearance.updated": {
    message: "A clearance update is available in Zentraq.",
    title: "Clearance update",
    type: "clearance",
  },
  "inventory.attention": {
    message: "An inventory item requires attention in Zentraq.",
    title: "Inventory update",
    type: "inventory",
  },
  "system.notice": {
    message: "A new system notice is available in Zentraq.",
    title: "System notice",
    type: "system",
  },
}
