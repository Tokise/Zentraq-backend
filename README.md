# Zentraq Backend

This independent repository contains Zentraq's Render services, shared Node.js
infrastructure, Supabase Edge Functions, and database migrations. In the
current paired workspace, this repository is `Zentraq-backend` and the sibling
frontend repository is `Zentraq`.

See the frontend's consolidated
[system documentation](https://github.com/Tokise/Zentraq/blob/rei/development/docs/system/SYSTEM.md)
for architecture, local workspace, deployment, and verification guidance. The
paired documentation set also contains the
[backlog](https://github.com/Tokise/Zentraq/blob/rei/development/docs/backlog/BACKLOG.md)
and [sprint record](https://github.com/Tokise/Zentraq/blob/rei/development/docs/sprint/SPRINT.md).

## Hybrid runtime boundary

```text
Next.js / Vercel
  UI + Auth cookies + login/logout/reset Server Actions
       |                                  |
       | user JWT                         | user JWT from RFID Server Action
       v                                  v
Render API Gateway                 rfid-check-in Edge Function
       |                                  |
       | signed context / Edge HMAC       | check_in_rfid_v1
       v                                  |
Render services + clinical-service Edge   |
       \__________________________________/
          Supabase Auth + PostgreSQL + RLS + Storage + PGMQ + Cron
```

The public gateway has only the Supabase project URL and publishable key. It
must never receive a Supabase secret/service-role key. It validates the user
with `auth.getUser`, calls the authenticated `resolve_request_context_v1()`
RPC, and signs only the verified user ID and active roles.

`rfid-check-in` is called directly by its Next.js Server Action with the
operator's user JWT. The protected `check_in_rfid_v1` RPC independently verifies
an active Admin, Doctor, or Nurse account and preserves event idempotency.
`clinical-service` remains gateway-only and requires the original JWT plus the
replay-bounded gateway HMAC.

## Render services

`render.yaml` declares six Free Web Services:

| Service | Port | Responsibility |
| --- | ---: | --- |
| API Gateway | 4000 | Authentication, routing, request IDs, rate limits, bounded timeouts, and stable envelopes |
| Appointment | 4003 | Booking, availability, ownership, assignment, and state transitions |
| Inventory | 4004 | Stock, idempotent receipts, and atomic dispensing |
| Notification | 4005 | User notification APIs and protected PGMQ drain endpoint |
| Reporting | 4006 | Audits, aggregates, report jobs, artifacts, and protected PGMQ drain endpoint |
| AI | 4007 | Advisory OpenRouter results without database mutation credentials |

Identity and Clinical service source directories remain temporarily as rollback
and comparison code, but they are not Render deploy targets. Delete them only
after deployed role, browser, and RFID acceptance tests pass.

Render Free services can sleep after inactivity and are demo infrastructure,
not production infrastructure. The frontend shows an accessible cold-start
state. GET requests receive at most one automatic retry. Mutations are not
automatically retried; RFID can be retried explicitly with the same `eventId`.

## Worker boundary

Supabase retains PGMQ queues, private durable job records, status RPCs,
visibility timeouts, retries, and dead-letter state. Render exposes only:

- `POST /internal/workers/notifications/drain`
- `POST /internal/workers/reports/drain`
- `POST /internal/workers/report-deliveries/drain`

Both require `x-zentraq-service-key` and bound batch sizes. The local migration
`20260819204546_hybrid_gateway_context_and_workers.sql` changes Supabase Cron
to inspect queue metrics first and call only fixed Render URLs stored in Vault.
It never accepts a caller-provided URL.

Required Vault names are:

- `zentraq_notifications_worker_url`
- `zentraq_reports_worker_url`
- `zentraq_report_deliveries_worker_url`
- `zentraq_worker_service_key`

Keep the old Edge worker functions until each deployed Render worker passes
queue, retry, dead-letter, and empty-queue acceptance tests.

## Local development

Requirements are Node.js 22 or newer and pnpm 11.19.0.

```powershell
Set-Location D:\Documents\Coding\zentraq\backend

if (-not (Test-Path .env.local)) {
  Copy-Item .env.example .env.local
}

pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run dev
```

Fill every placeholder in the ignored `.env.local` before starting. The normal
`pnpm run dev` command builds `@zentraq/shared`, loads `.env.local` inside each
service process, and starts only the six current Render targets on ports 4000
and 4003 through 4007. It intentionally excludes the rollback-only Identity
and Clinical Node services. Use `pnpm run dev:legacy` only when explicitly
testing those two rollback implementations.

Every service exposes `GET /health`. Environment placeholders belong in
`.env.example`; real values stay in ignored local files and deployment secret
stores. `EDGE_GATEWAY_HMAC_SECRET` must be at least 32 characters and must
match the secret configured for the deployed `clinical-service` and
`rfid-check-in` Edge Functions. A local-only value lets the gateway start but
cannot authenticate against Edge Functions configured with a different value.

## Supabase source and migration safety

The complete `supabase\` source tree is versionable. Only
`supabase\.temp\` and `supabase\functions\node_modules\` remain ignored.
`clinic.sql` is a non-migration snapshot under `supabase\baselines\clinic.sql`.
The duplicate `20250726000007` local version was resolved by assigning the
rename migration `20250726000008`.

Do not run `supabase db push` or migration repair while the remote ledger still
records only `001`. First compare every local migration with the live schema,
run database and security advisors, and repair only individually verified
history entries.

## Security boundary

- Rotate the database password and Vercel OIDC token exposed during earlier
  diagnostics. Source cleanup cannot rotate external credentials.
- Never place Supabase secret/service-role keys, database URLs, internal HMAC
  keys, or provider credentials in the frontend or public gateway.
- Validate all input server-side and rely on caller-scoped RLS by default.
- Protect cross-table mutations with authenticated atomic RPCs.
- Return minimized DTOs and sanitized errors; propagate `x-request-id`.

## Verification boundary

Local typechecks and tests prove source consistency only. Before removing
rollback code or legacy frontend actions, verify deployed health endpoints,
wrong-role access, cross-patient isolation, RFID tap output, HMAC expiry and
replay rejection, Cron-to-Render queue processing, empty-queue behavior,
Storage artifacts, browser traffic, and unchanged UI workflows.

## Optional Google Workspace delivery

Reporting Service can upload completed aggregate workbooks to an explicitly
shared Google Drive folder and publish fixed sanitized ranges to Google Sheets.
Notification Service can send metadata-only links through a dedicated Gmail
mailbox. Both integrations default to disabled, use separate credentials, and
must be staged independently.

Source implementation does not configure Google, Render, Supabase Vault, Cron,
or Looker Studio. Follow the Google Workspace section in the frontend
repository's `docs/system/SYSTEM.md` before enabling either flag.
