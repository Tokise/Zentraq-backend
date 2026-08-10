# Zentraq Product and Technical Backlog

**Last reviewed:** 2026-08-11

This document contains only work that remains incomplete, partially verified, or
deferred in the current system. Implemented history belongs in
[COMPLETED_SPRINTS.md](COMPLETED_SPRINTS.md), while committed work for the active
week belongs in [SPRINT.md](SPRINT.md).

Repository evidence is not proof of deployed behavior. Items involving Supabase
migrations, RLS, grants, views, functions, Storage, or Realtime remain open until
they are verified in the target project.

## Status model

| Status | Meaning |
| --- | --- |
| Current sprint | Committed in the active sprint |
| Ready | Defined well enough to schedule next |
| Policy decision | Requires clinic, privacy, legal, or security approval |
| Deferred | Valuable but not release-critical |
| Deployment verification | Source exists; target-environment behavior is unverified |

## Current sprint commitments

These items are detailed in [SPRINT.md](SPRINT.md).

| ID | Work item | Status | Release impact |
| --- | --- | --- | --- |
| ZQ-201 | Make the Supabase schema reproducible and capture missing app-facing view definitions | Current sprint | Release blocker |
| ZQ-202 | Verify RLS, grants, privileged RPCs, Storage, and role isolation in the target project | Current sprint | Release blocker |
| ZQ-203 | Repair staff appointment history and cancellation ownership mapping | Current sprint | Patient workflow blocker |
| ZQ-204 | Add critical role-by-role browser and automated workflow tests | Current sprint | Release blocker |
| ZQ-205 | Remove the PHI encryption fallback and require managed secrets before use | Current sprint | Security blocker |

## Priority 1 — Security, privacy, and operations

### ZQ-206 — Distributed rate limiting

**Status:** Ready

Replace the process-memory rate limiter with an atomic shared store suitable for
multiple Next.js instances. Cover login, appointment submission, RFID scanning,
exports, and other abuse-sensitive actions. Define safe proxy-IP handling,
failure behavior, reset headers, and concurrency tests.

### ZQ-207 — Production Content Security Policy

**Status:** Ready

Remove `unsafe-eval` from the production CSP and reduce `unsafe-inline` through
nonces or hashes where Next.js and the UI stack permit. Verify login, charts,
dialogs, themes, Realtime, and production builds before enforcement.

### ZQ-208 — Audit reliability and monitoring

**Status:** Ready

Inventory every security-sensitive workflow and define mandatory events. Make
critical audit delivery transactional or outbox-backed, alert when writes fail,
protect logs from ordinary mutation, set retention, and add a review workflow.
Current audit writes are selective and fail open to server logs.

### ZQ-209 — Centralized observability and incident response

**Status:** Ready

Configure protected application and Supabase log drains, uptime checks, alert
ownership, security-event dashboards, clock synchronization, and escalation.
Create tested incident, breach-notification, downtime, and evidence-preservation
runbooks.

### ZQ-210 — Storage hardening

**Status:** Ready

Verify the `student-documents`, `faculty-documents`, `staff-documents`,
`compliance-documents`, and `announcement-images` buckets. Enforce intended
privacy, per-object ownership, file-size limits, MIME/signature validation,
malware scanning, short signed URLs, deletion behavior, and download auditing.

### ZQ-211 — Privileged authentication controls

**Status:** Ready

Require MFA for clinic roles, privileged reauthentication for sensitive admin
actions, secure account recovery, short and reviewed session lifetimes, periodic
access reviews, and rapid role/session revocation during offboarding.

### ZQ-212 — Privacy operations program

**Status:** Policy decision

Approve the data inventory, lawful bases, privacy notice, retention schedule,
legal holds, deletion and correction procedures, data-subject request handling,
backup retention, media disposal, workforce training, and physical safeguards.
Assign privacy/DPO, security, clinical, and system owners.

### ZQ-213 — External AI governance

**Status:** Policy decision

Keep real-patient OpenRouter use disabled until the organization approves data
minimization, provider retention/training terms, subprocessors, data location,
deletion, security review, and the required data-processing or business-associate
agreement. Add an explicit enablement flag and a non-AI operating path.

## Priority 2 — Application correctness and maintainability

### ZQ-214 — Unify the permission model

**Status:** Ready

Reconcile the `roles`/`permissions` catalog with hardcoded Server Action role
lists and fixed portal prefixes. Keep a secure default-deny model and add tests
showing whether database permission changes should or should not affect runtime
authorization.

### ZQ-215 — Complete account and profile settings

**Status:** Ready

Replace the current “Coming soon” profile settings page with a server-validated
workflow. Separate self-editable contact fields from protected identity,
employment, role, and clinical fields. Audit sensitive changes.

### ZQ-216 — Report and export completion audit

**Status:** Ready

Review every report, template, checklist, and export route for real data,
authorization, assignment scoping, formula accuracy, empty states, large-data
behavior, CSV injection protection, and PHI-safe export handling. Add PDF only
where a defined operational requirement exists.

### ZQ-217 — Historical schema and migration cleanup

**Status:** Deployment verification

After live dependency inspection, document or retire superseded objects such as
`profiles`, `student_accounts`, `faculty_accounts`, `student_appointments`,
`check_ins`, and `visit_logs`. Do not delete a live object until view, function,
foreign-key, export, and rollback dependencies are proven absent.

### ZQ-218 — Accessibility and responsive audit

**Status:** Ready

Run WCAG 2.2 AA keyboard, focus, name/role/value, contrast, screen-reader, reduced
motion, and zoom checks across all six portals. Test tables, tabs, comboboxes,
dialogs, charts, pagination, file previews, and 768–1024 px tablet layouts.

### ZQ-219 — Performance and large-data testing

**Status:** Ready

Measure dashboard, record search, consultation history, reports, and attachment
loading with production-sized data. Add indexes only from measured query plans,
verify query bounds, remove avoidable waterfalls, and establish performance
budgets.

### ZQ-220 — CI/CD and release controls

**Status:** Ready

Add protected CI for TypeScript, ESLint, tests, migration validation, secret and
dependency scanning, and `git diff --check`. Define staging promotion, rollback,
environment approvals, migration ordering, and a release checklist.

### ZQ-221 — Backup, restore, and disaster recovery

**Status:** Policy decision

Define recovery-point and recovery-time objectives. Verify encrypted backups,
restore procedures, access, retention, deletion propagation, regional/provider
failure response, and clinic downtime operation through scheduled exercises.

## Priority 3 — Deferred product capabilities

| ID | Capability | Status | Notes |
| --- | --- | --- | --- |
| ZQ-301 | External email/SMS reminders | Deferred | Requires provider selection, consent, delivery status, opt-out, templates, and PHI-safe content |
| ZQ-302 | Bulk patient/account import | Deferred | Requires validated CSV mapping, duplicate handling, dry run, audit, and rollback |
| ZQ-303 | Enrollment or HR identity synchronization | Deferred | Requires authoritative-source contract, reconciliation, deactivation, and failure handling |
| ZQ-304 | Offline/PWA kiosk mode | Deferred | Requires encrypted local state, conflict handling, expiry, device control, and safe recovery |
| ZQ-305 | Internationalization | Deferred | Extract UI and validation messages only after primary workflows stabilize |
| ZQ-306 | Longitudinal clinical timeline | Deferred | Use authorized existing records; define grouping, filtering, and performance requirements |
| ZQ-307 | Dedicated laboratory-result workflow | Deferred | Define ordering, result entry, reference ranges, attachments, amendments, and clinician acknowledgment |
| ZQ-308 | Clinically governed decision support | Policy decision | Requires clinical safety case, validation, monitoring, human override, and prohibited-use rules |

## Removed from the old backlog

The following are no longer backlog items because current source contains real
implementations: six role portals, faculty/staff records, shared clinical visits
and history, RFID queue/check-in, appointment booking and review, prescriptions
and dispensing, health programs, clearances/compliance records, roles and
permissions UI, audit-trail UI, role-scoped analytics, shared chart components,
dark theme support, notifications, and the searchable visit-reason catalog.

Their deployment, security, and end-to-end verification work remains represented
by the active sprint and Priority 1 items rather than being mislabeled as missing
features.

## Backlog intake rules

A new item must identify the user or operational outcome, affected roles and
data scope, privacy/security impact, dependencies, acceptance criteria, and
verification method. A source-complete item moves to
[COMPLETED_SPRINTS.md](COMPLETED_SPRINTS.md) only after its code and local checks
exist; deployment-dependent work remains explicitly marked until verified.
