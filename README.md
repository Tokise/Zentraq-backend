# Zentraq Backend Microservices

This repository contains Zentraq's independently runnable Node.js, Express,
and TypeScript backend services. The existing Next.js application remains in
the separate frontend repository and sends clinic-domain requests only to the
API Gateway.

## Architecture

```text
Next.js / Vercel
        |
        | /api/v1/* + Supabase access token
        v
API Gateway / Render public web service
        |
        | signed, expiring internal context
        v
Identity | Clinical | Appointments | Inventory
Notifications | Reporting | AI
        |
        v
One Supabase project: Auth + PostgreSQL + Storage + Queues + Edge Functions
```

Only the API Gateway is intended to be public. Domain services are configured
as Render private services. If a budget plan requires protected web services,
the frontend must still use only the gateway, CORS must remain restricted, and
every service must continue to reject unsigned direct access.

## Service ownership

| Service | Port | Responsibility |
| --- | ---: | --- |
| API Gateway | 4000 | Public routing, request IDs, CORS, rate limiting, authentication coordination, timeouts, and public error envelopes |
| Identity Service | 4001 | Supabase token validation, protected role resolution, profiles, clinic accounts, patient references, and RFID identity lookup |
| Clinical Service | 4002 | Patient-owned and clinician-assigned records, visits, consultations, and the RFID Edge Function adapter |
| Appointment Service | 4003 | Booking, availability, appointment ownership, assignment, and state transitions |
| Inventory Service | 4004 | Catalog stock views, idempotent receipts, atomic dispensing RPC orchestration, and dispensing logs |
| Notification Service | 4005 | User-scoped notification reads, read state, and asynchronous notification jobs |
| Reporting Service | 4006 | Sanitized audit events, role-scoped dashboard aggregates, report jobs, and signed report downloads |
| AI Service | 4007 | Advisory OpenRouter scheduling and inventory outputs; no database mutation credentials |

The shared package contains only cross-service infrastructure: response types,
pagination, request IDs, structured logging, Supabase client factories,
timeouts, and signed internal context. It contains no domain repository or
business workflow.

## Authentication and internal trust

1. The frontend authenticates with Supabase Auth and sends
   `Authorization: Bearer <access-token>` to the gateway.
2. The gateway calls Identity Service over the internal network.
3. Identity Service validates the token with Supabase Auth and resolves roles
   from `user_roles` and `roles`; it never authorizes from user metadata.
4. The gateway creates a short-lived HMAC-signed context bound to the request
   ID.
5. Every domain service validates that signature, expiry, and request binding.

`INTERNAL_SERVICE_KEY` protects machine-only endpoints. It is separate from
`INTERNAL_CONTEXT_SECRET`, the Supabase secret key, and the OpenRouter key. Use
independent random values with at least 32 characters and rotate them through
Render secrets.

## Local development

Requirements:

- Node.js 22 or newer
- pnpm 11.19.0
- an authorized non-production Supabase project or local Supabase stack

Copy `.env.example` to an untracked `.env` and set only the values required by
each process. For a simple local session, a root environment can provide all
service URLs and secrets.

The tracked `.env.example` must contain descriptive placeholders only. Never
paste an `sb_secret_...`, legacy `service_role` JWT, OpenRouter key, or internal
signing secret into it. Adding a file to `.gitignore` does not remove a secret
from commits that already contain the file; rewrite unpushed history or follow
the approved incident-response procedure for published history.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm dev
```

Every service exposes `GET /health`. Health responses contain only status and
service name.

## Public API summary

- `GET /api/v1/users/me`
- `GET /api/v1/users`
- `POST /api/v1/rfid/lookup`
- `POST /api/v1/rfid/check-ins`
- `GET|POST /api/v1/appointments`
- `GET|PATCH /api/v1/appointments/:appointmentId`
- `GET /api/v1/appointments/availability`
- `GET /api/v1/records/me`
- `GET /api/v1/records/:patientType/:patientId`
- `GET /api/v1/consultations`
- `GET /api/v1/visits`
- `GET /api/v1/inventory/stock`
- `POST /api/v1/inventory/restock`
- `POST /api/v1/inventory/dispense`
- `GET /api/v1/inventory/dispensing`
- `GET|POST /api/v1/notifications`
- `PATCH /api/v1/notifications/:notificationId`
- `GET /api/v1/dashboard/:role`
- `GET /api/v1/audit`
- `POST /api/v1/reports`
- `GET /api/v1/reports/:reportId`
- `GET /api/v1/reports/:reportId/download`
- `POST /api/v1/ai/appointments/recommend`
- `POST /api/v1/ai/inventory/insights`

Collection endpoints use `page` and `limit` and return a consistent pagination
object. Public errors use stable codes and do not include raw Supabase errors,
stack traces, tokens, or internal URLs.

## Data and failure boundaries

- One Supabase project remains the Auth, PostgreSQL, and Storage platform.
- Existing public tables remain in place for the initial migration. Service
  ownership is enforced in code before schema extraction.
- Clinical workflow RPCs remain transaction boundaries.
- Dispensing uses `dispense_medicine_v1`, which atomically validates the
  prescription and stock, creates one idempotent dispensing record, and updates
  prescription state while preserving the existing stock-decrement trigger.
- Notification and audit failures do not roll back a successful appointment or
  stock operation. Failures are logged with request IDs for retry/operations.
- AI failures return a deterministic, labeled fallback. AI never schedules an
  appointment or changes stock directly.

## Render deployment

`render.yaml` declares one public web service and seven private services with
service-specific build filters and environment variables. The Blueprint source
is ready for review, but this repository does not claim the services are
deployed until Render health checks, private networking, secrets, and
independent redeploy behavior are verified in the target account.

## Verification boundary

Passing local tests and builds proves source consistency only. Before migrating
frontend call sites or removing a Server Action, verify:

- missing/invalid/expired token responses;
- wrong-role and unsigned direct-service rejection;
- Student, Faculty, and Staff cross-account ownership isolation;
- Doctor and Nurse assignment filters;
- atomic inventory behavior under concurrent and retried requests;
- Supabase migrations, RLS, grants, RPC ownership, Storage, and Realtime;
- Render private service discovery, timeout behavior, and service secrets;
- browser Network requests and unchanged role workflows.
