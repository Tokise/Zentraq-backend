# Hybrid Render and Supabase Migration

Last source verification: 2026-08-17 (Asia/Manila)

## Decision

Zentraq uses a hybrid service boundary:

```text
Next.js on Vercel
  -> Render API Gateway
  -> Render domain service
  -> Supabase Auth, PostgreSQL, Storage, RPCs

Render Clinical Service
  -> rfid-check-in Edge Function
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
Set-Location D:\Documents\Coding\zentraq-backend
supabase status
supabase migration list --linked
supabase functions list --project-ref rhjnhwlkfegqbimgumxn
```

## Retained Edge Function inventory

| Remote name | Responsibility | verify_jwt | Live status observed | Local source SHA-256 |
| --- | --- | --- | --- | --- |
| `rfid-check-in` | User-scoped RFID transaction adapter | `true` | ACTIVE, version 4 | `402665738c263963b9d5e64f39bd2cd61472b50565a1a34e940be844bd22915e` |
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

`POST /api/v1/rfid/check-ins`

- Gateway routes this path to Clinical Service before the generic RFID
  identity route.
- Gateway forwards the original user bearer token and a signed internal
  context.
- Clinical Service permits Admin, Doctor, and Nurse roles only.
- Both layers validate/rate-limit the request.
- Clinical Service invokes `rfid-check-in`; it does not duplicate the
  transaction.
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

The gateway needs `INTERNAL_SERVICE_KEY`,
`INTERNAL_CONTEXT_SECRET`, `ALLOWED_ORIGINS`, and the seven downstream
service URLs. It does not need a Supabase secret key.

### Render domain services

Each service receives only the Supabase and internal values it uses.
Services performing privileged RPCs need a server-only Supabase secret key.
Clinical and Notification services also need the publishable key for
user-scoped calls. Prefer distinct service secrets when the Supabase project
supports independent server-key rotation.

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
