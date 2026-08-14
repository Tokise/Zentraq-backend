# Zentraq Completed Sprints

**Project start:** 2026-07-13

**Last reviewed:** 2026-08-14

This is a source-based delivery history. **Completed** means the implementation
is present in the current repository and has received the local checks recorded
for that work. It does not prove that migrations, RLS, grants, Storage, Realtime,
or external services are correctly deployed.

Current committed work is tracked in [SPRINT.md](SPRINT.md). Remaining work is
tracked in [BACKLOG.md](BACKLOG.md).

## Current source baseline

| Measure | Current source |
| --- | ---: |
| Portal roles | 6: admin, doctor, nurse, student, faculty, staff |
| Role-specific pages | 133 total: 49 admin, 29 doctor, 29 nurse, 9 student, 9 faculty, 8 staff |
| Context-schema tables | 68 in `supabase/migrations/clinic.sql` |
| App-referenced views | 9; local definitions still require capture/verification |
| App-facing RPCs | 4: RFID check-in, consultation claim/finalization, program approval |
| Shared activity series | 6: total, student, faculty, walk-in, appointment, RFID |

## Ten-submodule delivery coverage

The original Clinic Management System submodules are the canonical product
structure. A submodule can span several delivery sprints because foundations,
role portals, shared workflows, and hardening were implemented incrementally.

| Module | Original submodule | Primary source-completed sprints | Remaining boundary |
| --- | --- | --- | --- |
| 1 | Student Medical Records Management | Sprints 2, 3, and 4 | RFID, ownership, Storage, and target authorization verification |
| 2 | Clinic Visit & Consultation Logging | Sprints 2, 4, and 5 | RPC deployment, concurrency, grants, and role tests |
| 3 | Medicine Inventory & Dispensing | Sprints 3 and 5 | Live zero-stock receipt, concurrency, audit, and worker verification |
| 4 | Appointment Scheduling System | Sprint 3 | Staff ownership repair, runtime tests, reminder deployment, and AI governance |
| 5 | Incident & Emergency Case Management | Sprint 3 | Role, ownership, workflow-state, and deployment verification |
| 6 | Faculty & Staff Health Services | Sprints 2, 3, and 4 | Patient-type isolation, signed files, and external-source contract |
| 7 | School Health Program Monitoring | Sprint 3 | Approval RPC, participant scope, grants, and deployment verification |
| 8 | Health Clearance and Certification | Sprints 3 and 4 | Storage hardening, signed-URL ownership, and role verification |
| 9 | Reporting and Compliance | Sprints 3 and 5 | Report-worker deployment, export security, observability, backup, and recovery |
| 10 | User Access & Confidentiality Control | Sprints 1 through 5 | RLS/grants, MFA, rate limiting, CSP, secrets, privacy, and six-role tests |

## Historical planning-ID crosswalk

The former `ZQ-*` identifiers below are retained only to audit the planning-ID
migration completed on 2026-08-14. They are not active backlog or sprint IDs;
current work uses the `F1`–`F100` catalog in [BACKLOG.md](BACKLOG.md).

| Former ID | Canonical story | Migration note |
| --- | --- | --- |
| ZQ-200 | F90 | Documentation baseline |
| ZQ-201 | F89 | Database reproducibility |
| ZQ-202 | F95 | Supabase authorization verification |
| ZQ-203 | F40 | Staff appointment ownership repair |
| ZQ-204 | F100 | Critical workflow and browser verification |
| ZQ-205 | F98 | Fail-closed PHI secret handling |
| ZQ-206 | F97 | Distributed rate limiting |
| ZQ-207 | F98 | Production Content Security Policy |
| ZQ-208–ZQ-209 | F88 | Audit reliability, observability, and incident response |
| ZQ-210 | F80 and F95 | Storage and authorization hardening |
| ZQ-211 | F96 | Privileged authentication controls |
| ZQ-212–ZQ-213 | F36 and F99 | Privacy operations and external AI governance |
| ZQ-214–ZQ-215 | F93 | Permission model and profile settings |
| ZQ-216 | F86 and F87 | Report and export completion and security |
| ZQ-217 | F89 | Historical schema and migration cleanup |
| ZQ-218–ZQ-219 | F100 | Accessibility and performance verification |
| ZQ-220–ZQ-221 | F90 | CI/CD, backup, restore, and disaster recovery |
| ZQ-301 | F37 | External email or SMS reminders |
| ZQ-302 | F9 and F59 | Bulk patient and account import |
| ZQ-303 | F59 | Enrollment or HR identity synchronization |
| ZQ-304 | F11 | Offline or PWA kiosk enhancement |
| ZQ-305 | F100 | Internationalization after workflow stabilization |
| ZQ-306 | F8 and F57 | Longitudinal clinical timeline |
| ZQ-307 | F5 and F54 | Dedicated laboratory-result workflow |
| ZQ-308 | F20 and F36 | Clinically governed decision support |

## Sprint 1 — Foundation, Design System, and Authentication

**Period:** 2026-07-13 to 2026-07-23

### Completed deliverables

- Next.js App Router application with TypeScript, Tailwind CSS, and pnpm.
- Local Supabase configuration, migrations folder, and seed workflow.
- Shared dashboard shell, responsive sidebar, page headers, status badges,
  loading/empty states, buttons, dialogs, forms, tables, and notifications.
- Supabase email/password authentication and server-side login/logout actions.
- Role detection and default portal routing.
- Six-role type model covering admin, doctor, nurse, student, faculty, and staff.
- Server-only service-role client separated from browser/session clients.
- Password-strength validation and branded login feedback.

### Verification boundary

Authentication code and route structure are source-complete. Provider password
policy, MFA, production secrets, email delivery, token lifetime, and deployed
Auth configuration remain environment-dependent.

## Sprint 2 — Identity, RFID, Records, and Core Consultations

**Period:** 2026-07-22 to 2026-07-29

### Completed deliverables

- User, role, permission, role-assignment, clinic-account, student, faculty, and
  staff profile models.
- RFID registration workflow for students, faculty, staff, and clinic accounts.
- RFID patient search, software scanner route, check-in, visit creation, and
  clinic queue foundations.
- Student and employee record search with role-aware detail workspaces.
- Medical history, allergy, medication, immunization, and document surfaces.
- Clinic visits, consultations, triage, diagnosis, treatment, prescription, and
  follow-up schema/workflow foundations.
- Consultation status, origin, deduplication, and compatibility migrations.
- Custom one-device session records and invalidation checks.

### Superseded historical contracts

Early iterations used names and routes such as `profiles`, `student_accounts`,
`student_appointments`, `/patients`, and `/consultations`. Current source uses
`clinic_accounts`, role-specific patient tables, `appointments`, and role portal
routes. Historical migration objects require live dependency review before any
cleanup.

### Verification boundary

RFID and consultation migrations exist locally. Atomic behavior, target grants,
RLS, duplicate protection, and hardware/workstation security remain part of the
current release-verification sprint.

## Sprint 3 — Role Portals and Operational Modules

**Period:** 2026-07-29 to 2026-08-07

### Completed deliverables

- Separate admin, doctor, nurse, student, faculty, and staff route trees and
  navigation.
- Top-level role-route enforcement in `proxy.ts` and active custom-session checks.
- Patient self-service dashboards, announcements, appointments, own health
  records, consultation history, and clearance routes.
- Clinic-employee “My Health” records and consultation history when linked to a
  staff patient profile.
- Appointment booking, availability, date-specific schedule blocks, conflict
  checks, review, recommendations, reminders, check-in, and rescheduling.
- Optional, staff-triggered appointment AI evaluation with Zod validation and a
  human-review fallback.
- Medicine catalog, stock, batches, prescriptions, dispensing logs, expiry,
  low-stock, and restock workflows.
- Incident reporting, listing, responses, referrals, follow-ups, closure, and
  emergency-contact routes.
- Health-program proposal, approval, participant, screening, immunization,
  schedule, enrollment, and report workflows.
- Health-clearance request, requirements, evaluation, certificate, history, and
  compliance-record workflows.
- Roles, permissions, approval, password reset, settings, services, and audit UI
  foundations.

### Verification boundary

The modules have real routes and Server Actions rather than generic placeholder
pages. Function-level authorization still depends on explicit action role lists,
and target RLS/grants must be tested. The shared profile settings page remains
incomplete and is tracked in the backlog.

## Sprint 4 — Shared Clinical Workspaces, Realtime, and Compliance

**Period:** 2026-08-07 to 2026-08-09

### Completed deliverables

- Shared active-visit and visit-history workspaces for admin, doctor, and nurse.
- Assignment-aware doctor/nurse queue, history, dashboard, and appointment
  filtering, with clinic-wide admin behavior where implemented.
- Atomic RFID check-in, consultation claim, nurse handoff, and doctor/admin final
  review database functions.
- Nurse restriction from diagnosis, treatment, prescription, and follow-up
  payloads during finalization.
- Private Realtime invalidation topics for the RFID queue, user notifications,
  and authorized patient records.
- Realtime payload minimization: clients receive change markers and reload
  authorized Server Action DTOs.
- Student, faculty, and staff compliance records, medical examinations, sick
  leave, supporting documents, and annual compliance state.
- Shared record tabs and signed-document workspaces for clinic and patient views.
- Security-advisor remediation migrations for private helpers, RLS policy helper
  calls, function search paths, and narrower execution grants.

### Verification boundary

The Realtime and security SQL is versioned locally, but applied publication,
topic-policy, function-owner, grant, RLS, and Storage behavior is not confirmed
until tested against the target Supabase project.

## Sprint 5 — Consultation Experience, Analytics, and Documentation

**Period:** 2026-08-09 to 2026-08-11

### Completed deliverables

- Shared consultation wizard using the common Tabs components while preserving
  nurse handoff and doctor/admin review steps.
- Shared UI tables for active visits and visit history.
- Pagination that remains visible for empty, single-page, and multi-page data,
  including `0 to 0 of 0` behavior and disabled navigation controls.
- Accessible searchable Base UI visit-reason combobox with common reasons,
  keyboard support, no-results feedback, and an `Other` entry path.
- Canonical `consultations.patient_complaint` application contract and
  compatibility migration for older complaint column names.
- Normalized, case-insensitive reusable `complaints` catalog with conflict-safe
  publication only after completed doctor/admin review.
- Shared vertical bar charts for categorical status data.
- Generic interactive area chart supporting all six activity series and an
  accessible visibility legend.
- Role-scoped dashboard and report aggregates for admin, doctor, and nurse.
- Reorganized Server Actions by domain with documented server-boundary rules.
- Current-system README and five-chapter Software Architecture Document covering
  architecture, data infrastructure, roles, privacy, and security.
- Current backlog, active sprint, and completed-sprint history reconciled with
  source evidence and deployment-verification boundaries.

### Locally completed checks

- Documentation links and table-of-contents anchors resolve.
- All 68 reference tables, nine code-referenced views, four application RPCs,
  and five Storage buckets are cataloged in the architecture document.
- Stale framework versions, obsolete active routes/schemas, unsafe public
  service-key examples, and broken encoding were removed from primary docs.
- Markdown table structure, code-fence balance, terminology scans, and
  `git diff --check` passed for the documentation rewrite.

### Known limitations carried forward

- The nine code-referenced views do not yet have complete reviewed definitions
  captured in the local migration set.
- Migrations, RLS, grants, RPCs, Storage, and Realtime remain deployed-unverified.
- Staff appointment creation uses `staff_id`, but current history/cancellation
  actions still use the faculty mapping.
- The PHI helper has an unsafe fallback and is not integrated with clinical
  persistence.
- Rate limiting is process-local; CSP retains unsafe allowances; audit coverage
  and monitoring are incomplete.
- Critical E2E and role-by-role browser verification are not yet recorded.

These limitations are committed to Sprint 6 or retained in the prioritized
backlog; they are not silently treated as completed production controls.

## Completion policy

Future entries should record the delivered behavior, affected roles, evidence,
tests actually run, and remaining deployment or operational boundaries. A page
file, migration file, or passing TypeScript check alone is not enough to claim a
production-ready workflow.
