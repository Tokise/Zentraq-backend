# Zentraq Backend Microservices Migration Report

**Audit date:** 2026-08-17  
**Frontend repository:** `zentraq` (target name: `zentraq-frontend`)  
**Backend repository:** `zentraq-backend`  
**Status vocabulary:** `Implemented (source)`, `Partially migrated`,
`Deployment verification`, and `Planned`  
**Implementation update:** local source completed and verified on 2026-08-17;
cloud deployment and call-site cutover remain open

## 1. Purpose and migration rule

This report is the Phase 0 audit required before extracting Zentraq into
independently deployable backend services. It maps current source behavior to
service ownership without treating folders, pages, or individual database
tables as microservices.

The migration is additive and incremental. Existing Server Actions and
Supabase-backed workflows remain available until the equivalent gateway path
is implemented, tested, deployed, and verified for every affected role. A
working path must not be removed merely because a replacement exists in
source.

## 2. Current source architecture

The current frontend is one Next.js 16 application with role-specific routes
for Administrator, Doctor, Nurse, Student, Faculty, Staff, login, and the RFID
kiosk. Server Actions are organized by domain and perform most clinic-data
access. Supabase provides Auth, PostgreSQL, Storage, Realtime, database RPCs,
and three focused Edge Function boundaries:

- `notifications-worker`
- `reports-worker`
- `rfid-check-in`

The browser creates a Supabase client for Auth session monitoring and private
Realtime invalidation topics. The audited components do not contain direct
browser `.from()` clinic-table queries. Clinic data is nevertheless still read
and written directly from the frontend repository's Server Actions, so it has
not yet crossed an independently deployable API Gateway.

## 3. Supabase usage inventory

### 3.1 Client boundaries

| Client | Current use | Migration decision |
| --- | --- | --- |
| Browser client | Auth state and private Realtime broadcasts | Retain for Supabase Auth and Realtime during the staged migration |
| Cookie-aware server client | Authenticated user lookup and RLS-scoped operations | Retain for login/session code; replace clinic-domain access only after an API is verified |
| Server-only privileged client | Domain actions, minimized reads, RPCs, Storage, and audit writes | Move domain access into owning backend services; never expose its key |
| Edge Function client | Notification/report jobs and authenticated RFID check-in | Retain until an owning Render service has an operationally verified replacement |

### 3.2 Static application-referenced tables and views

The audit found 68 static table, view, or bucket-like `.from()` identifiers,
plus controlled dynamic identifiers derived from validated patient roles and
document types. Major groups are:

- Identity and access: `users`, `roles`, `permissions`, `user_roles`,
  `role_permissions`, `clinic_accounts`, `students`, `faculty`, `staff`, and
  `user_sessions`.
- Scheduling: `appointments`, `appointment_ai_evaluations`,
  `appointment_recommendations`, `appointment_reminders`,
  `appointment_checkins`, `staff_availability`, and
  `clinician_schedule_blocks`.
- Clinical: `clinic_visits`, `consultations`, `triage_assessments`,
  `diagnoses`, `treatments`, `follow_ups`, `prescriptions`, patient history,
  allergy, medication, immunization, and document tables, `incidents`,
  `health_clearances`, and health-program tables.
- Inventory: `medicines`, `medicine_stock`, `dispensing_logs`, and the stock
  summary view. The schema snapshot also identifies suppliers, batches, and
  restock requests.
- Communications and reporting: `notifications`, `announcements`,
  `audit_logs`, report views, generated report artifacts, and aggregate views.
- AI: `ai_logs` and appointment-evaluation records.

Dynamic table and bucket selection currently exists for Student, Faculty, and
Staff patient data. The backend migration must retain strict allowlists; a
client-provided schema, table, or bucket name must never be passed directly to
Supabase.

### 3.3 Application-facing RPCs

The source calls the following RPCs:

- `approve_health_program`
- `claim_consultation`
- `enqueue_report_request`
- `finalize_consultation_workflow`
- `get_available_review_doctors`
- `get_my_clinician_duty_status`
- `get_report_request_status`
- `reassign_consultation_review`
- `review_medicine_catalog_item`
- `save_medicine_catalog_item`
- `set_my_clinician_duty_status`

These RPCs remain database transaction boundaries. They must not be replaced
with several non-atomic service calls.

### 3.4 Storage and Realtime

Application source references private or controlled Storage buckets for clinic
profile photos, Student documents, Faculty documents, Staff documents,
compliance documents, generated reports, and announcement images. Signed URL
issuance and ownership validation remain transactional server concerns.

Private Realtime broadcasts currently invalidate notification, queue, and
patient-record views. Realtime is not evidence that the browser is authorized
to read the underlying tables. Topic authorization, RLS, grants, and deployed
publication state require target-project verification.

## 4. Proposed service ownership map

| Service | Owned business capabilities | Initial table ownership |
| --- | --- | --- |
| API Gateway | Public `/api/v1` entry, authentication coordination, routing, request IDs, rate limiting, timeouts, and public errors | None |
| Identity Service | User identity, clinic profiles, patient profiles, roles, permissions, account state, and RFID identity lookup | `users`, `clinic_accounts`, `students`, `faculty`, `staff`, `roles`, `permissions`, `user_roles`, `role_permissions`, `user_sessions` |
| Appointment Service | Booking, calendar, availability, assignment, waitlist, reminders orchestration, check-in state, and scheduling validation | `appointments`, `appointment_recommendations`, `appointment_reminders`, `appointment_checkins`, `staff_availability`, `clinician_schedule_blocks`, `appointment_ai_evaluations` |
| Clinical Service | Visits, consultations, vitals, diagnosis, treatments, follow-up, prescriptions, medical histories, documents, incidents, staff health, clearances, and health programs | Clinical tables and protected clinical workflow RPCs |
| Inventory Service | Medicine catalog, stock receipts, batches, dispensing, low stock, expiry, and stock movement calculations | `medicines`, `medicine_stock`, `dispensing_logs`, suppliers, batches, and restock requests |
| Notification Service | In-app notifications, reminders, delivery jobs, and future email delivery | `notifications` and private notification jobs/queues |
| Reporting Service | Audit records, aggregates, dashboard DTOs, exports, and generated report lifecycle | `audit_logs`, private report requests/queues, report views, and generated-report artifacts |
| AI Service | OpenRouter calls, prompt ownership, response validation, appointment recommendations, and inventory insights | No direct critical-data mutation; AI logs may be written through Reporting Service |

Prescriptions remain clinically authored. Inventory owns dispensing and stock
mutation. The cross-domain prescription identifier is shared, but Inventory
must not edit clinical narrative or prescribing decisions.

## 5. Cross-domain relationships

The current shared PostgreSQL database has legitimate cross-domain foreign
keys. The initial migration retains them because removing them before service
APIs are stable would increase data-integrity risk.

Important relationships include:

- Auth user ID to Identity profiles and role assignments.
- Patient profile IDs to appointments, clinic visits, incidents, clearances,
  documents, and program participation.
- Clinic account IDs to appointments, consultations, triage, availability,
  clearances, and prescription favorites.
- Appointment IDs to consultations, reminders, evaluations,
  recommendations, and check-ins.
- Consultation IDs to diagnoses, treatments, follow-ups, and prescriptions.
- Prescription IDs to dispensing logs; medicine IDs to stock rows.
- User IDs to notifications, audit events, and AI logs.

Services exchange opaque UUIDs and minimized DTOs. A service requiring another
domain's data must call that domain's API rather than casually querying its
tables. Cross-schema migration and service-specific database roles are deferred
until network boundaries and deployment behavior are stable.

## 6. Authentication and authorization design

Supabase Auth remains the only password and OAuth authentication system. The
frontend sends the Supabase access token to the API Gateway. The gateway asks
Identity Service to validate the token with Supabase Auth and resolve roles
from protected database records. Authorization must never use browser-provided
user IDs, roles, `user_metadata`, or unsigned internal headers.

The gateway forwards a short-lived, HMAC-signed internal context containing the
verified user ID, authorized roles, request ID, and expiry. Every internal
service verifies the signature and expiry before accepting the context. Render
private networking is preferred; protected web services are only a budget
fallback and still require internal authentication and restricted CORS.

Although the supplied plan lists five roles in one section, the source has a
working Staff portal and Staff patient type. The migration therefore preserves
`staff` in addition to `admin`, `doctor`, `nurse`, `student`, and `faculty`.
Removing Staff would violate the preservation requirement and current schema.

## 7. Security and reliability findings

| Severity | Finding | Required control |
| --- | --- | --- |
| Resolved in source (formerly High) | PHI encryption previously fell back to a hardcoded repository string when no key was configured. | `lib/crypto-phi.ts` now fails closed unless `PHI_ENCRYPTION_KEY` is present and at least 32 characters; managed-key operations and field integration remain open. |
| High | Privileged Supabase clients bypass RLS. A missing backend role or ownership check becomes BOLA/IDOR. | Authenticate first, resolve roles from protected records, verify ownership/assignment, select explicit columns, then use privileged access. |
| High | Unsigned `X-User-Role` or service headers could be spoofed if accepted. | Use signed, expiring internal context and a separate internal service credential; reject direct browser access. |
| High | Clinical and inventory workflows span related writes. Naive network decomposition could create partial medical or stock state. | Keep existing protected RPC/trigger transaction boundaries; avoid distributed transactions. |
| Medium | The existing in-memory frontend rate limiter is process-local and does not coordinate across serverless instances. | Add gateway rate limiting now and plan a shared limiter only when measured scale requires it. |
| Medium | AI code currently resides in the frontend repository and reads a server environment key. | Move provider calls to AI Service; keep recommendations advisory and validate them in the owning service. |
| Medium | Browser Realtime remains coupled to Supabase topic policy. | Retain temporarily, verify private topic authorization, and do not mistake UI visibility for authorization. |
| Medium | Remote migration history previously differed from local migration files. | Reconcile migration history and run advisors before applying schema or grant changes. |

Structured logs must not contain access tokens, refresh tokens, passwords,
secret keys, RFID values, or unnecessary medical payloads. Audit records should
store stable event names, actor and resource identifiers, and sanitized
metadata.

## 8. Migration sequence and stop conditions

1. Create and test the backend workspace, shared infrastructure, API Gateway,
   and Identity Service.
2. Verify token validation, role resolution, signed internal context, and
   `/api/v1/users/me` through the gateway.
3. Add one domain service at a time, starting with appointments, then clinical,
   inventory, notifications, reporting, and AI.
4. Keep existing Server Actions until corresponding backend endpoints pass
   authentication, wrong-role, ownership, validation, unavailable-service, and
   response-shape tests.
5. Add the frontend API client and Vercel rewrite. Migrate call sites only after
   the target service is deployed and verified.
6. Reconcile Supabase migrations before any new database change is pushed.
7. Introduce domain schemas and service-specific PostgreSQL roles only after
   service APIs and operational ownership are stable.

Stop and retain the current implementation when any of these are unverified:

- remote migration history or target schema;
- service secrets and private-network behavior;
- Supabase Auth, Google OAuth, or session refresh;
- Student, Faculty, or Staff ownership isolation;
- Doctor/Nurse assignment filtering;
- atomic clinical and inventory transitions;
- signed Storage access or private Realtime authorization.

## 9. Verification evidence required

Source completion is not deployment completion. Final verification requires:

- backend install, type check, lint, unit/integration tests, and production
  builds from a frozen pnpm lockfile;
- health checks for all eight Render services;
- 401 tests for missing/invalid/expired tokens;
- 403 tests for wrong roles and direct internal-service requests;
- cross-account ownership tests for Student, Faculty, and Staff;
- assignment tests for Doctor and Nurse;
- validation tests for UUIDs, dates, RFID input, status, quantities,
  pagination, and search;
- timeout and failure-isolation tests for Identity, AI, Notification, Supabase,
  and gateway routing;
- browser Network inspection proving migrated clinic calls use `/api/v1/*`;
- Render deployment evidence showing eight independent services;
- target Supabase migration, RLS, grant, view, RPC, Storage, Realtime, Cron, and
  advisor verification.

## 10. Implemented source and verification result

### 10.1 Backend repository

A separate local Git repository exists at `D:\Documents\Coding\zentraq\backend`
on branch `rei/dev`, with verified source committed locally as `49624fa`. It
contains a pnpm workspace, shared contracts and security
middleware, one public API Gateway, and seven domain services:

- Identity Service;
- Appointment Service;
- Clinical Service;
- Inventory Service;
- Notification Service;
- Reporting Service; and
- AI Service.

The root `render.yaml` defines the gateway as the only public web service and
the domain services as Render private services. Each service has an independent
build filter and health endpoint. No GitHub remote or Render deployment is
claimed.

### 10.2 Frontend transition source

The frontend now has a shared typed API client, a server helper that forwards
the current Supabase access token, and a conditional Next.js rewrite from
`/api/v1/*` to `BACKEND_URL`. No clinic call site was switched because the plan
requires deployed replacement verification before removing a working path.
Auth and private Realtime remain direct Supabase browser responsibilities.

### 10.3 Database migration source

Migration `20260816225526_atomic_inventory_dispensing.sql` defines
`dispense_medicine_v1`. It locks the prescription and stock rows, validates the
Admin/Nurse role and workflow state, applies idempotency, records dispensing,
and preserves the stock invariant in one database transaction. Execution is
revoked from `PUBLIC`, `anon`, and `authenticated`, then granted only to
`service_role`.

The migration was generated with Supabase CLI 2.114.0 but was not applied or
pushed. A previously observed remote/local migration-history mismatch remains
a stop condition.

### 10.4 Local evidence

| Check | Result | Boundary |
| --- | --- | --- |
| Backend frozen install | Passed with pnpm 11.19.0 | Local dependency and lockfile evidence only |
| Backend ESLint | Passed with pinned ESLint 10 and TypeScript ESLint | Static source evidence; TypeScript is pinned to supported 6.0.3 |
| Backend TypeScript | All workspace services passed | Does not exercise Supabase or network behavior |
| Backend automated tests | Four files, eight tests passed | Shared signing, gateway, identity, and AI cases; domain integration coverage remains incomplete |
| Backend production builds | All packages passed | Does not prove Render compatibility or deployed secrets |
| Backend health smoke | All eight services returned `status: ok` locally | Used synthetic secrets and no live Supabase workflow |
| Frontend focused ESLint | Passed | Scoped to changed frontend files |
| Frontend TypeScript | Passed | Static source evidence only |
| Frontend production build | Passed with network access | Initial sandbox run could not fetch Google Fonts; the escalated rerun compiled and generated 145 routes |

### 10.5 Open promotion gates

Before the first call-site cutover, the team must establish the GitHub remotes,
deploy Render and Vercel environments, configure scoped secrets, reconcile and
apply reviewed Supabase migrations, and test the gateway through every positive
and negative role path. Appointment/clinical ownership, clinician assignment,
inventory concurrency, report authorization, notification idempotency, AI
fallback, and dependency timeout behavior need staging integration evidence.

The initial implementation session changed no cloud state because browser
access to GitHub was not granted. The backend is now configured with
`Tokise/Zentraq-backend`, but its first push was rejected and the remote still
had no branch refs at remediation time. Render and Vercel deployment, secret
entry, and billing-affecting configuration remain unperformed.

### 10.6 GitHub push-protection remediation

On 2026-08-17, GitHub rejected the first backend push because the original root
commit contained an `sb_secret_...` value in `.env.example`. Deleting or
ignoring the file in a later commit did not resolve the finding because push
protection scans every reachable commit.

The unpushed `rei/dev` history was rebuilt as clean root commit `49624fa`.
The tracked example now contains descriptive placeholders, `.gitignore`
explicitly permits only `.env.example`, and reachable-history scans contain no
Supabase secret, JWT, or provider-key pattern. If the removed value came from
a real Supabase project, it must still be replaced and deleted through the
project's API-key settings; history cleanup does not revoke credentials.
