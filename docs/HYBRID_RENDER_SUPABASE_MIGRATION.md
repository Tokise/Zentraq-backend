# Hybrid Render and Supabase Migration

Last source verification: 2026-08-20 (Asia/Manila)

## Decision

Zentraq uses a hybrid service boundary:

```text
Next.js on Vercel
  -> Render API Gateway
  -> Render domain service or clinical-service Edge Function
  -> Supabase Auth, PostgreSQL, Storage, RPCs

RFID Scanner Server Action
  -> rfid-check-in Edge Function with the operator JWT
  -> check_in_rfid_v1

Render Notification/Reporting Service
  -> queue RPC
  -> Supabase worker
  -> private job state and result
```

The frontend retains Supabase Auth, cookie refresh, and access-token
retrieval. It must not receive a Supabase secret key,
`INTERNAL_SERVICE_KEY`, or `INTERNAL_CONTEXT_SECRET`.

## Source ownership move

The complete `supabase/` source directory moved from
`zentraq/supabase/` to `zentraq-backend/supabase/`. The move preserved
53 source files and was verified with SHA-256 file comparisons before the
old source directory was removed. Local link state and function
`node_modules` are excluded from Git.

Moving source did not deploy, replace, pause, or delete any remote object.

Run Supabase CLI commands from `zentraq-backend`:

```powershell
Set-Location D:\Documents\Coding\zentraq\backend
supabase status
supabase migration list --linked
supabase functions list --project-ref rhjnhwlkfegqbimgumxn
```

## Retained Edge Function inventory

| Remote name | Responsibility | verify_jwt | Live status observed | Local source SHA-256 |
| --- | --- | --- | --- | --- |
| `rfid-check-in` | User-scoped RFID transaction adapter | `true` | ACTIVE, version 6 | `A3BDC7C139B27E47932F28A726DB156D8A6DB6DC1E35A6D5FD82F9715D50EFDB` |
| `notifications-worker` | Claims and completes notification jobs | `false` with named secret auth | ACTIVE, version 5 | `c611a374cc600d892102539c755e1e87471acc38253e4306203a0a34c7d32a2e` |
| `reports-worker` | Claims report jobs and creates private XLSX artifacts | `false` with named secret auth | ACTIVE, version 4 | `351ff62c413f6093328b49a53b50a9db98dead830fcd0b795bc337a60c0d024e` |

The linked project reference observed during inventory was
`rhjnhwlkfegqbimgumxn`. Project references are identifiers, not
credentials; secrets remain outside source control.

Live read-only catalog checks also found:

- `check_in_rfid_v1`;
- notification enqueue, claim, complete, and fail RPCs;
- report enqueue, claim, status, complete, and fail RPCs;
- private notification and report job tables;
- PGMQ notification and report queues;
- active one-minute `zentraq-notifications-worker` and
  `zentraq-reports-worker` Cron jobs.

## Critical migration-history blocker

On 2026-08-17, `supabase migration list --linked` reported remote migration
`001` only. Local history contains `002` and the later timestamped
migrations through `20260817044209`.

The local directory also contains two migrations with version
`20250726000007` and a non-versioned `clinic.sql` file that the CLI skips.
Resolve those naming/history issues as part of the same reconciliation.

The live schema contains objects from later source migrations, but their
versions are not recorded in the remote migration ledger. Therefore:

- do not run `supabase db push`;
- do not run migration repair without a reviewed object-by-object audit;
- do not deploy the new notification status RPC yet;
- do not interpret a successful source build as database parity.

The new
`20260817044209_notification_job_status.sql` migration is source-only until
the history is reconciled.

## Implemented HTTP contracts

### RFID

The RFID scanner does not use a Render route. Its Server Action invokes the
`rfid-check-in` Edge Function with the current Supabase user JWT.

- The Server Action validates same-origin input and applies a per-operator
  request limit.
- Edge JWT verification remains enabled.
- `check_in_rfid_v1` independently requires an active Admin, Doctor, or Nurse
  assignment and performs the transaction atomically.
- Explicit retries reuse the same `eventId`; arbitrary mutations are not
  retried automatically.
- Private profile-photo paths become five-minute signed URLs.
- Audit metadata excludes the RFID value and patient identity.

### Notifications

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications`
- `PATCH /api/v1/notifications/:notificationId`
- `POST /api/v1/notification-jobs`
- `GET /api/v1/notification-jobs/:jobId`

Routine reads and read-state writes use a request-scoped Supabase client with
the caller token, preserving RLS. Job submission uses the elevated
server-only client because the queue RPC is service-role-only. Public job
states are `queued`, `processing`, `succeeded`, and `failed`.

The existing internal direct-notification endpoint remains temporarily for
Appointment Service compatibility. It must move to a service-authorized queue
contract after migration history is reconciled.

### Reports

- `POST /api/v1/report-jobs`
- `GET /api/v1/report-jobs/:jobId`
- `GET /api/v1/report-jobs/:jobId/result`

The legacy `/api/v1/reports` aliases remain compatible. Only the existing
`clinic-aggregate` worker report type is accepted. Submission is
idempotent, status is normalized, and result access rechecks Admin ownership
before issuing a five-minute Storage URL.

## Environment ownership

### Vercel frontend

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-publishable-key
BACKEND_URL=https://api-services.onrender.com
```

Do not add a Supabase secret/service-role key or either Render internal
secret to Vercel.

### Render gateway

The gateway needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_EDGE_FUNCTIONS_URL`, `EDGE_GATEWAY_HMAC_SECRET`,
`INTERNAL_CONTEXT_SECRET`, `ALLOWED_ORIGINS`, and the five Render domain
service URLs. It does not receive `SUPABASE_SECRET_KEY` or
`INTERNAL_SERVICE_KEY`.

### Render domain services

Each service receives only the Supabase and internal values it uses. Render
services performing protected RPCs need a server-only Supabase secret key.
Notification and Reporting worker-drain endpoints also require
`INTERNAL_SERVICE_KEY`. The two clinical Edge Functions use the caller JWT and
`EDGE_GATEWAY_HMAC_SECRET`; their default database access remains caller-scoped.
Prefer distinct secrets and rotate them through Render and Supabase secret
stores.

## Manual deployment sequence

1. Reconcile and review Supabase migration history without changing live
   objects.
2. Apply the reviewed notification-status migration.
3. Redeploy domain services.
4. Verify each service `/health`.
5. Redeploy the API gateway.
6. Exercise RFID, notification, and report contracts with allowed and denied
   roles.
7. Deploy the frontend with the production `BACKEND_URL`.
8. Verify browser traffic uses the gateway and no direct Edge Function call
   remains.
9. Continue migrating Identity, Inventory, Appointments, and remaining
   Clinical operations before removing legacy frontend server credentials.

## Verification boundary

Local TypeScript, tests, and builds establish source consistency only. They do
not prove that Render environment values, Supabase migrations, Cron, queues,
secrets, webhooks, or function versions are correct in production.
## 2026-08-20 source implementation update

Implemented locally:

- unified independent repositories under `zentraq\frontend` and
  `zentraq\backend`;
- direct gateway token validation plus `resolve_request_context_v1()` source;
- direct, independently HMAC-protected `clinical-service` and `rfid-check-in`
  Edge routes with caller JWT forwarding;
- standard success/error envelopes and request-ID propagation;
- protected Render notification and report drain endpoints using existing
  atomic queue RPCs;
- queue-aware fixed-URL Cron-to-Render migration source;
- six Free Render Web Services with Identity and Clinical removed from
  `render.yaml`;
- Supabase source tracking, baseline relocation, and duplicate local migration
  version correction.

Not verified live:

- the new migration is not applied because the remote ledger remains unsafe;
- Edge Functions and Render services are not deployed by this source change;
- Vault values, Cron execution, RLS behavior, browser traffic, and physical RFID
  tap delivery still require acceptance tests;
- old Identity/Clinical and Edge worker source remains until those tests pass.
## 2026-08-20 verification evidence

Passed locally:

- backend `pnpm run typecheck`;
- backend `pnpm run test` with 17 passing tests;
- backend `pnpm run lint` and `pnpm run build`;
- frontend `pnpm exec tsc --noEmit`;
- targeted frontend ESLint for RFID, API client, action, and Next config;
- frontend `pnpm run build`, including all 145 application routes;
- Deno check, lint, and formatting for `clinical-service`, `rfid-check-in`,
  and shared Edge helpers;
- frontend and backend `git diff --check`;
- current-tree and Git-history high-risk credential pattern scans;
- read-only linked `supabase db lint`.

The linked database lint reported one pre-existing warning: local variable
`v_is_final_reviewer` is never read in `public.finalize_consultation_workflow`.
The migration ledger still shows remote `001` only, so `db push` and migration
repair remain blocked. The installed CLI exposes database lint but not the
Dashboard Security Advisor; run and archive that advisor before deployment.

No deployment, migration application, Vault update, Cron invocation, credential
rotation, or live RFID/browser acceptance test was performed.
## 2026-08-20 local startup incident

Observed failure:

```text
Error: INTERNAL_CONTEXT_SECRET must contain at least 32 characters.
Error: INTERNAL_SERVICE_KEY must contain at least 32 characters.
```

The values in the ignored root `.env.local` were already long enough. The
failure occurred because recursive package scripts started `tsx` without
loading that file. The root launcher also still included the rollback-only
Identity and Clinical Node services after `render.yaml` had been reduced to six
services.

Implemented locally:

- each service development script now loads `../../.env.local` with Node's
  native `--env-file` option;
- the normal launcher builds `@zentraq/shared` first and runs only API Gateway,
  Appointment, Inventory, Notification, Reporting, and AI;
- `pnpm run dev:legacy` preserves an explicit path for the two rollback
  services;
- the ignored local environment gained the new Edge Functions URL and a
  cryptographically random 64-character gateway HMAC secret;
- obsolete local Identity and Clinical service URLs were removed.

Startup verification passed for all six `GET /health` endpoints on ports 4000
and 4003 through 4007. The smoke-test processes were then stopped. This does
not verify a physical RFID tap or deployed Edge authentication. Before live
RFID testing, configure the same `EDGE_GATEWAY_HMAC_SECRET` in the gateway and
both protected Supabase Edge Functions without copying it into source control
or frontend configuration.
## 2026-08-20 direct RFID Edge cutover

Live read-only inspection found `rfid-check-in` active at version 4 while the
new gateway context migration was not applied and no gateway HMAC secret was
configured in Supabase. This prevented the source-defined gateway path from
reliably reaching RFID.

Implemented and verified:

- the frontend RFID Server Action now invokes `rfid-check-in` directly with the
  caller session;
- the API Gateway no longer advertises `/api/v1/rfid/check-ins`;
- the Edge Function keeps `verify_jwt = true`, relies on the protected RPC for
  clinic-role authorization, returns minimized envelopes, and signs approved
  private photo paths;
- Edge source passed Deno type, lint, and format checks;
- API Gateway tests and backend typechecks passed;
- `rfid-check-in` was deployed alone and is ACTIVE at version 6;
- an unauthenticated live POST returned 401 before handler execution;
- no database migration, repair, or `db push` was performed.

A physical registered-card tap still requires an authenticated clinic operator
and must be verified at the kiosk. That acceptance test can create a real visit
and therefore was not simulated with an invented RFID value.

## 2026-08-20 Realtime consistency and clinic event repair

Live, aggregate-only diagnostics identified three independent failures:

- `check_in_rfid_v1()` creates consultations with status `queued`, while the
  deployed `claim_consultation()` definition does not accept `queued`.
  Four live waiting queue rows were affected at inspection time.
- Five legacy profile photos remain inline `data:` URLs. The RFID Edge
  Function intentionally accepts only private `clinic-profile-photos`
  object paths, so these values are rejected instead of being returned as
  large or untrusted image payloads.
- One report request remains queued. Cron is active, but Vault contains only
  the previous Edge-worker secret names; the Render worker URL and service-key
  names required by `invoke_zentraq_render_worker()` are absent.

Source repairs now include:

- `20260819234721_realtime_domain_consistency.sql`, which accepts fresh
  `queued` consultations, preserves row locking and role checks, emits
  minimized private domain invalidations, and creates owned consultation and
  terminal appointment notifications.
- Explicit access-token binding for private Realtime channels plus a shared
  dashboard domain bridge. RFID queue and announcement workspaces reload
  authorized Server Action DTOs instead of reading database rows in the
  browser.
- Immediate bounded notification/report drains when an already-awake Render
  Web Service enqueues a job. PGMQ remains the durable source of truth and
  Cron remains a recovery path.
- `scripts/migrate-profile-photo-data-urls.mjs`, which uploads validated
  legacy images to the private bucket before conditionally replacing each
  database value. Its dry run found five candidates and changed zero rows.
- Removal of the scanner's obsolete “Starting clinic API…” message. RFID now
  uses a direct Edge Function and no Render cold start is involved.

Verification completed before any remote schema mutation:

- Frontend TypeScript and targeted ESLint passed.
- Backend workspace typecheck passed.
- Notification and Reporting service suites passed: four tests each.
- Live database lint completed with one pre-existing unused-variable warning.
- Advisors still report existing security/performance warnings that require a
  separate RLS/RPC remediation pass.

The remote migration ledger still records only `001`. Therefore
`supabase db push` was not used. Applying the single reviewed migration and
running the five-row photo conversion remain pending explicit approval; source
checks alone do not prove a physical tap, Realtime delivery, consultation
claim, or report completion in the live UI.
