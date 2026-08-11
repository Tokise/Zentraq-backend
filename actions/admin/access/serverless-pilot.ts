"use server"

import { randomUUID } from "node:crypto"
import { z } from "zod"
import { logAuditEvent } from "@/lib/audit-logger"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

const pilotJobSchema = z.object({
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/),
})

export interface EnqueueServerlessPilotJobResult {
  correlationId?: string
  error?: string
  jobId?: string
  success?: boolean
}

export interface ServerlessPilotJobStatus {
  status: "queued" | "processing" | "completed" | "dead_letter"
  attempts: number
  errorCode: string | null
  updatedAt: string
}

// Enqueues one admin-authorized, metadata-only smoke-test service job.
export async function enqueueServerlessPilotJobAction(
  input: unknown,
): Promise<EnqueueServerlessPilotJobResult> {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { error: "Unauthorized" }
  }
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin" }
  }

  const rate = checkRateLimit(
    `serverless-pilot:${actor.id}`,
    5,
    60 * 1000,
  )
  if (!rate.success) {
    return { error: "Too many pilot requests. Please wait and try again." }
  }

  const parsed = pilotJobSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Enter a valid idempotency key." }
  }

  const correlationId = randomUUID()
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("enqueue_service_job", {
    requested_by: actor.id,
    requested_correlation_id: correlationId,
    requested_idempotency_key: parsed.data.idempotencyKey,
    requested_job_type: "platform.smoke_test",
  })

  if (error || typeof data !== "string") {
    return { error: "The serverless pilot job could not be queued." }
  }

  await logAuditEvent({
    action: "SERVERLESS_PILOT_JOB_ENQUEUED",
    userId: actor.id,
    email: actor.email,
    resource: data,
    details: {
      correlation_id: correlationId,
      job_type: "platform.smoke_test",
    },
  })

  return {
    correlationId,
    jobId: data,
    success: true,
  }
}

// Returns one Admin-owned smoke job without exposing queue message contents.
export async function getServerlessPilotJobStatusAction(
  jobId: string,
): Promise<{
  error: string | null
  job: ServerlessPilotJobStatus | null
}> {
  const actor = await getActionActor()
  const parsedId = z.string().uuid().safeParse(jobId)
  if (!actor || !hasAnyRole(actor, ["admin"]) || !parsedId.success) {
    return { error: "Unauthorized", job: null }
  }

  const { data, error } = await createAdminClient().rpc(
    "get_service_job_status",
    {
      requested_job_id: parsedId.data,
      requested_by: actor.id,
    },
  )
  const row = data?.[0]

  if (error || !row) {
    return { error: "Smoke job status is unavailable.", job: null }
  }

  return {
    error: null,
    job: {
      status: row.status,
      attempts: row.attempts,
      errorCode: row.error_code,
      updatedAt: row.updated_at,
    },
  }
}
