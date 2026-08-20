# Server Action boundaries

Server Actions are Zentraq's browser-facing backend-for-frontend boundary. Page
and client components import actions from this directory and must not use a
privileged Supabase client directly.

During the two-repository migration, these actions remain the working clinic
paths. A capability may move to `lib/api` and the `zentraq-backend` Gateway only
after its deployed service passes authentication, role, ownership/assignment,
validation, transaction, timeout, and six-role browser verification. Do not
delete an action merely because an equivalent backend endpoint exists in local
source.

## Domain map

- `access/` - roles, permissions, and audit-trail reads.
- `accounts/` - account administration and patient-portal recovery.
- `appointments/` - scheduling, requests, review, availability, and queries.
- `auth/` - login and authenticated session commands.
- `clinical/` - clearances, incidents, prescriptions, records, visits, and
  cross-clinical queues.
- `communications/` - announcements and the authenticated notification inbox.
- `dashboard/` - role-scoped dashboard summaries.
- `health-programs/` - program proposals, enrollment, screening, and reports.
- `inventory/` - medicine catalog, stock, dispensing, and inventory queries.
- `profiles/` - Student, Faculty, Staff, and patient self-service data.
- `reports/` - aggregate analytics and queued workbook exports.
- `rfid/` - check-in, queue, patient lookup, and registration.
- `settings/` - clinic configuration.

Role names are not directory boundaries. A shared Doctor/Nurse/Admin action
lives with its domain and authorizes its allowed roles inside the action.
Administrator-only actions follow the same rule.

## Naming and security

- Use kebab-case filenames named for one concrete capability, such as
  `patient-lookup.ts` or `audit-trail.ts`.
- Export client-invoked queries and mutations with a `<verb><Noun>Action`
  name. All moved actions were normalized atomically with their importers.
  `login` and `logout` retain their existing names because login behavior is
  outside this change.
- Do not add compatibility wrappers when moving an action. Move the
  implementation and update all importers atomically.
- Every action re-authenticates, checks the canonical role and resource scope,
  validates untrusted input, returns a minimized DTO, and logs sensitive
  mutations.
- Authorize before creating a service-role client. Service-role credentials and
  raw Supabase rows must never be returned to the browser.

The retained `accounts/faculty.ts`, `clinical/records/faculty-documents.ts`, and
`clinical/records/staff-documents.ts` modules currently have no static UI
importer. They are kept as audited domain candidates and must not be described
as active workflows until they are wired and role-tested.
