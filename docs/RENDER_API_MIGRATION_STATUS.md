# Render API Migration Status

Last source verification: 2026-08-20 (Asia/Manila)

## Frontend boundary

The frontend keeps:

- Supabase Auth clients;
- cookie and session refresh;
- login and logout;
- protected layouts and server-side authorization guards;
- `lib/api/client.ts` and `lib/api/server.ts`.

Most migrated domain data flows through `authenticatedApiRequest()` to the
Render gateway. RFID is the deliberate exception: its Server Action invokes
the dedicated `rfid-check-in` Edge Function with the current user session. The
browser still does not query clinical tables or receive privileged credentials.

## Completed cutovers

| Domain | Frontend path | Runtime path | Status |
| --- | --- | --- | --- |
| RFID check-in | `actions/rfid/check-in.ts` | `rfid-check-in` Edge Function | Deployed v6 |
| Notification list/count | `actions/communications/notifications.ts` | `GET /api/v1/notifications*` | Source migrated |
| Notification read state | same action file | `PATCH /api/v1/notifications*` | Source migrated |
| Aggregate report request | `actions/reports/exports.ts` | `POST /api/v1/report-jobs` | Source migrated |
| Report status/result | same action file | `GET /api/v1/report-jobs/:id*` | Source migrated |

RFID uses `supabase.functions.invoke()` only inside its server-only action; the browser never invokes the function or database directly.
Report actions no longer use a frontend elevated client or sign Storage URLs.
Notification actions no longer query the notification table directly.

## Infrastructure source move

The complete `supabase/` directory is now owned by
`D:\Documents\Coding\zentraq\backend\supabase`. Run Supabase CLI,
migration, function, seed, and local-stack commands from the backend
repository.

The removed frontend directory is a source ownership change only. It did not
alter deployed functions, schedules, queues, secrets, or database objects.

## Remaining migration work

Direct Supabase domain calls still exist in other Server Actions. Do not remove
their files until corresponding gateway contracts and role/ownership tests
pass. Remaining work is tracked by domain:

1. Identity and access administration.
2. Inventory catalog, receiving, and review workflows.
3. Appointment workflows not covered by the current API DTOs.
4. Remaining clinical visits, consultation workflow, documents, incidents,
   clearances, and health programs.
5. Internal Appointment Service notification creation must move from the
   compatibility insert to the notification queue.
6. AI remains deferred.

Because these paths remain, the frontend is not yet ready for removal of every
server-only legacy Supabase credential. The target production state is still:
no Supabase secret key in Vercel.

## Required environment

Local:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-local-publishable-key
BACKEND_URL=http://localhost:4000
```

Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-publishable-key
BACKEND_URL=https://api-services.onrender.com
```

Never add `SUPABASE_SECRET_KEY`, a service-role JWT,
`INTERNAL_SERVICE_KEY`, or `INTERNAL_CONTEXT_SECRET` to a
`NEXT_PUBLIC_` value.

## Acceptance gates before cleanup

For each domain:

- allowed roles succeed;
- denied roles return controlled `401` or `403`;
- patient ownership and clinician assignment remain enforced;
- retries do not duplicate writes;
- Render cold starts and timeouts return controlled errors;
- UI behavior remains unchanged;
- static searches show no old `.from()`, `.rpc()`, Storage, or
  `functions.invoke()` call for the accepted domain;
- TypeScript and production builds pass.

Only then remove superseded exports, unused files, and direct dependencies.
## 2026-08-20 frontend integration update

The RFID Server Action owns authentication, same-origin validation, and input
rate limiting. It calls the dedicated `rfid-check-in` Edge Function directly
with the operator session. The kiosk exposes an accessible checking state and
an explicit retry that reuses the same RFID `eventId`. Arbitrary mutations are
not automatically retried.

The frontend local environment is reduced to publishable Supabase configuration
and server-only `BACKEND_URL`. Existing privileged legacy Server Actions remain
in source for incremental migration, but they no longer have an approved
frontend service-role environment. Migrate and acceptance-test each matching
API route before relying on those workflows or deleting rollback behavior.

This is source-verified only. Deployed Render, Supabase Edge, database migration,
RLS, physical scanner, and browser Network behavior remain unverified.
## 2026-08-20 login environment diagnosis

The login failure `SUPABASE_SERVICE_ROLE environment variable is missing` is
an environment-boundary failure. `actions/auth/login.ts`, `getUserRole()`, the
custom `user_sessions` workflow, proxy role checks, and audit logging still
use the transitional frontend admin client. A key stored in
`backend\.env.local` is not visible to the separate Next.js process in
`frontend`.

No secret was copied into the frontend during this diagnosis. Doing so would
restore the legacy monolith locally but would preserve an elevated credential
that bypasses RLS in the Vercel runtime. The preferred completion path is to
replace login and proxy admin queries with authenticated, caller-scoped role
and session contracts before removing the frontend credential. The existing
`resolve_request_context_v1()` source cannot be treated as live until its
migration is safely reconciled and applied.

Decision pending:

- preferred: complete the caller-scoped login/proxy migration and deploy its
  reviewed database contract;
- temporary exception: explicitly authorize a server-only
  `SUPABASE_SECRET_KEY` in the frontend and Vercel until every remaining
  privileged Server Action is migrated.

The secret must never use a `NEXT_PUBLIC_` name, enter source control, appear in
logs, or be sent to the browser.
## 2026-08-20 direct RFID Edge verification

The previous gateway route could fail before reaching RFID because it depended
on the unapplied `resolve_request_context_v1()` contract. The scanner action now
invokes the dedicated authenticated Edge Function directly. It validates the
legacy deployed v4 result shape and the standardized envelope, accepts only a
minimized typed DTO, and refuses raw Storage paths.

Verified:

- the restarted frontend serves `/rfid-kiosk/scanner` with HTTP 200;
- frontend TypeScript and targeted RFID lint pass;
- Supabase reports `rfid-check-in` ACTIVE at version 6 with JWT verification
  enabled;
- an unauthenticated live request is rejected with HTTP 401;
- no database migration or repair was run.

A real registered-card tap was not simulated because it can create a clinic
visit. Complete that final acceptance test while signed in as an active Admin,
Doctor, or Nurse.

## 2026-08-20 RFID, Realtime, and event consistency follow-up

The frontend now treats RFID as a direct Edge workflow and authenticated
Realtime as an invalidation channel:

- The scanner no longer displays “Starting clinic API…”. It reports only the
  active `Checking in…` state.
- The RFID Server Action performs one session validation, while the Edge
  Function and protected RPC remain authoritative for clinical-role access.
  This removes redundant role/account network round trips without trusting
  browser input.
- The dashboard mounts one private `app:changes` subscription. Its payload
  contains only an allowlisted domain name, then affected workspaces reload
  minimized Server Action DTOs. No patient row is delivered through the
  broadcast.
- RFID queue, patient-record, and notification topics explicitly bind the
  current access token before subscribing.
- Announcement feeds reload immediately on an announcement invalidation, and
  new announcements create an owned notification for each role-mapped user.

Live inspection found five legacy inline profile photos. They require the
reviewed private-Storage conversion script before the Edge Function can sign
them. The script's dry run found five candidates and changed no rows.

Frontend TypeScript and targeted ESLint passed. The database migration and
photo conversion are not yet applied because the remote migration ledger still
contains only `001`; live tap-photo, consultation claim, and cross-session
Realtime acceptance remain pending explicit approval and browser testing.

## 2026-08-20 RFID patient-profile handoff

The scanner confirmation and clinical record preview now have an explicit,
privacy-minimized handoff:

- A successful scanner tab sends only the new queue-entry UUID through a
  same-origin `BroadcastChannel`; it does not send demographics or medical
  content between browser tabs.
- The authenticated RFID workspace reloads the queue through its Server Action,
  verifies that the queue entry is visible to the current clinic operator, and
  then opens and scrolls to the existing read-only patient profile preview. The
  scroll respects the operator's reduced-motion preference.
- Private Realtime remains the cross-session fallback. A newly inserted queue
  entry is selected after the invalidation reload, while the newest waiting
  patient is selected on the workspace's initial load.
- The scanner screen continues to show only the patient's name, profile photo,
  and check-in outcome, limiting PHI exposure on a shared kiosk display.
- When the deployed Edge response has a null photo URL, the Server Action
  resolves the authoritative profile photo after the protected check-in
  succeeds. It accepts only signed HTTPS URLs or validated JPEG, PNG, and WebP
  legacy data URLs bounded to 150 KiB; raw Storage paths are never returned.
- The four-second confirmation lockout is removed. The latest result remains
  visible until another card is submitted, and input focus returns immediately
  after success so the next patient can tap without waiting.

This is source-verified behavior. A signed-in two-tab RFID acceptance test is
still required to confirm the deployed Realtime policies and browser workflow.
