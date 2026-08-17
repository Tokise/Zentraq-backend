# Render API Migration Status

Last source verification: 2026-08-17 (Asia/Manila)

## Frontend boundary

The frontend keeps:

- Supabase Auth clients;
- cookie and session refresh;
- login and logout;
- protected layouts and server-side authorization guards;
- `lib/api/client.ts` and `lib/api/server.ts`.

Domain data should flow through
`authenticatedApiRequest()` to the Render gateway. The helper uses
`http://localhost:4000` only in development and fails closed in production
when `BACKEND_URL` is missing.

## Completed cutovers

| Domain | Frontend path | Gateway path | Status |
| --- | --- | --- | --- |
| RFID check-in | `actions/rfid/check-in.ts` | `POST /api/v1/rfid/check-ins` | Source migrated |
| Notification list/count | `actions/communications/notifications.ts` | `GET /api/v1/notifications*` | Source migrated |
| Notification read state | same action file | `PATCH /api/v1/notifications*` | Source migrated |
| Aggregate report request | `actions/reports/exports.ts` | `POST /api/v1/report-jobs` | Source migrated |
| Report status/result | same action file | `GET /api/v1/report-jobs/:id*` | Source migrated |

RFID no longer calls `supabase.functions.invoke()` from the frontend path.
Report actions no longer use a frontend elevated client or sign Storage URLs.
Notification actions no longer query the notification table directly.

## Infrastructure source move

The complete `supabase/` directory is now owned by
`D:\Documents\Coding\zentraq-backend\supabase`. Run Supabase CLI,
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
