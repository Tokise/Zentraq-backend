# Zentraq Product Backlog (User Stories)

**Last reviewed:** 2026-08-17

This backlog uses the ten original Clinic Management System submodules as the
canonical product structure. Each submodule owns ten user stories, producing a
continuous catalog from `F1` through `F100`.

**Source and deployment boundary:** `Implemented (source)` means the workflow is
present in the repository. It does not prove that migrations, Row Level
Security (RLS), grants, Storage, Realtime, Cron, worker secrets, or external
services are correctly deployed. Those controls remain explicitly marked for
verification where applicable.

## Status model

| Status | Meaning |
| --- | --- |
| Implemented (source) | Production-oriented source exists; deployment-dependent behavior may still require verification |
| Current Sprint | Committed to the active sprint in [SPRINT.md](SPRINT.md) |
| Ready | Defined well enough to schedule after current commitments |
| Deployment Verification | Source exists, but target-environment behavior is unverified |
| Policy Decision | Requires clinic, privacy, legal, security, or clinical approval |
| Deferred | Valuable but not release-critical |

## Product backlog

| User Story No. | Features/Task | User Stories | Priority | Status |
| --- | --- | --- | --- | --- |
| **MODULE 1 — Student Medical Records Management** |  |  |  |  |
| F1 | Student record search | As authorized clinic personnel, I want to search student records by approved identifiers so that I can locate the correct patient without exposing unrelated records. | High | Implemented (source) |
| F2 | Student demographic profile | As authorized clinic personnel, I want to view the student's institutional and demographic profile so that care is associated with the correct person. | High | Implemented (source) |
| F3 | Masked contact and emergency information | As authorized personnel, I want sensitive contact fields masked according to my role so that only necessary information is disclosed. | High | Implemented (source) |
| F4 | Medical history | As a clinician, I want to review the student's medical history so that care decisions consider relevant prior conditions. | High | Implemented (source) |
| F5 | Allergies, medication, immunization, and future laboratory data | As a clinician, I want structured health-history data so that contraindications and preventive-care needs are visible. | High | Implemented (source) |
| F6 | Student medical documents | As an authorized user, I want protected document upload and signed preview access so that supporting records remain private. | High | Implemented (source) |
| F7 | Student own-record access | As a student, I want to view only my own authorized health record so that I can understand my clinic history without accessing another patient. | High | Implemented (source) |
| F8 | Longitudinal student health timeline | As a student or clinician, I want a chronological health timeline so that changes across visits are easier to understand. | Low | Deferred |
| F9 | Validated bulk student import | As an administrator, I want a dry-run, duplicate-safe import so that approved institutional records can be onboarded without overwriting existing patients. | Low | Deferred |
| F10 | Student RFID and record-privacy verification | As a security reviewer, I want RFID association, ownership, masking, and signed-document tests so that student data cannot be accessed through identifier manipulation. | High | Deployment Verification |
| **MODULE 2 — Clinic Visit & Consultation Logging** |  |  |  |  |
| F11 | Visit check-in | As clinic personnel, I want walk-in, appointment, and RFID check-in paths so that each patient enters one consistent visit workflow. | High | Implemented (source) |
| F12 | Waiting queue | As authorized clinic personnel, I want a current waiting queue so that visits can be handled in order without exposing clinical payloads through Realtime. | High | Implemented (source) |
| F13 | Atomic consultation claim | As a clinician, I want to claim a consultation atomically so that two clinicians cannot take the same patient concurrently. | High | Implemented (source) |
| F14 | Visit reason | As a clinician, I want searchable and validated visit reasons so that complaints are recorded consistently. | High | Implemented (source) |
| F15 | Vital signs and triage | As a clinician, I want to record vital signs or an approved skip reason so that incomplete triage is explicit. | High | Implemented (source) |
| F16 | Clinical notes | As a clinician, I want to record scoped consultation notes so that authorized follow-up care has sufficient context. | High | Implemented (source) |
| F17 | Nurse handoff | As a nurse, I want to hand a prepared consultation to a doctor without entering diagnosis or treatment so that clinical authority remains separated. | High | Implemented (source) |
| F18 | Doctor or admin final review | As an authorized final reviewer, I want to complete the consultation atomically so that related clinical records remain consistent. | High | Implemented (source) |
| F19 | Diagnosis, treatment, prescription, and follow-up | As an authorized clinician, I want related outcomes stored together so that the completed consultation is clinically coherent. | High | Implemented (source) |
| F20 | Consultation history and governed decision support | As an authorized user, I want scoped history and clinically governed assistance so that prior care informs decisions without autonomous diagnosis. | Medium | Policy Decision |
| **MODULE 3 — Medicine Inventory & Dispensing** |  |  |  |  |
| F21 | Medicine catalog | As authorized clinic personnel, I want an approved medicine catalog so that stock and prescriptions use consistent definitions. | High | Implemented (source) |
| F22 | Zero-stock inventory visibility | As an inventory user, I want approved catalog medicines shown even at zero stock so that new and depleted medicines can be restocked. | High | Implemented (source) |
| F23 | Batch management | As inventory personnel, I want stock tracked by batch and expiry so that medicine movement remains traceable. | High | Implemented (source) |
| F24 | Low-stock and expiry attention | As inventory personnel, I want low-stock, zero-stock, near-expiry, and expired items identified so that action can be taken promptly. | High | Implemented (source) |
| F25 | Restock workflow | As an Admin or Nurse, I want one validated receipt workflow so that stock increases are authorized, idempotent, and auditable. | High | Implemented (source) |
| F26 | Prescription review | As authorized clinic personnel, I want to review prescriptions against available stock so that dispensing decisions use current inventory. | High | Implemented (source) |
| F27 | Medicine dispensing | As authorized personnel, I want dispensing to update stock consistently so that issued medicine cannot exceed available inventory. | High | Implemented (source) |
| F28 | Dispensing logs | As an authorized reviewer, I want medicine movement logs so that stock changes can be investigated and reconciled. | High | Implemented (source) |
| F29 | Role-scoped inventory views | As a Doctor, Nurse, or Admin, I want inventory information appropriate to my role so that privileged stock actions remain restricted. | High | Implemented (source) |
| F30 | Transactional and serverless inventory verification | As a release reviewer, I want concurrent receipt, dispensing, idempotency, and attention-worker tests so that inventory remains correct under retries and load. | High | Deployment Verification |
| **MODULE 4 — Appointment Scheduling System** |  |  |  |  |
| F31 | Clinician availability | As a patient or clinic user, I want approved clinician availability so that appointments are offered only during valid periods. | High | Implemented (source) |
| F32 | Schedule blocks | As clinic personnel, I want date-specific schedule blocks so that unavailable times cannot be booked. | High | Implemented (source) |
| F33 | Patient appointment booking | As a Student, Faculty member, or Staff member, I want to request an available slot so that I can arrange clinic care. | High | Implemented (source) |
| F34 | Conflict prevention | As a scheduler, I want server-validated slot and ownership checks so that duplicate or unauthorized bookings are rejected. | High | Implemented (source) |
| F35 | Staff appointment review | As authorized clinic personnel, I want pending appointments reviewed with a human decision so that scheduling remains accountable. | High | Implemented (source) |
| F36 | Advisory AI evaluation with human fallback | As an authorized reviewer, I want optional validated advisory output so that it can assist, but never replace, human scheduling decisions. | Medium | Policy Decision |
| F37 | Appointment reminders | As a patient or clinician, I want timely private reminders so that missed appointments are reduced without disclosing PHI. | Medium | Implemented (source) |
| F38 | Reschedule, cancel, and check in | As an authorized user, I want controlled appointment transitions so that schedule state remains accurate. | High | Implemented (source) |
| F39 | Appointment history and clinic schedules | As an authorized user, I want role-scoped history and schedules so that I can review relevant appointment activity. | High | Implemented (source) |
| F40 | Staff appointment ownership repair | As a Staff patient, I want history and cancellation to resolve through my staff profile so that my own appointments work without exposing another person's records. | High | Current Sprint |
| **MODULE 5 — Incident & Emergency Case Management** |  |  |  |  |
| F41 | Patient incident reporting | As an eligible patient, I want to submit an incident report so that the clinic can respond to a health or safety concern. | High | Implemented (source) |
| F42 | Clinic incident logging | As clinic personnel, I want to record an incident directly so that urgent and reported cases use one controlled record. | High | Implemented (source) |
| F43 | Incident list and detail | As authorized clinic personnel, I want scoped incident views so that I can review cases without accessing unrelated data. | High | Implemented (source) |
| F44 | Severity and status classification | As clinic personnel, I want validated incident categories and states so that response priority is clear. | High | Implemented (source) |
| F45 | Emergency contacts | As authorized personnel, I want relevant emergency contacts available during a case so that escalation can occur promptly. | High | Implemented (source) |
| F46 | Incident response | As clinic personnel, I want to document actions taken so that the response remains accountable. | High | Implemented (source) |
| F47 | Referral management | As an authorized clinician, I want to record referrals so that care transferred outside the clinic remains traceable. | High | Implemented (source) |
| F48 | Incident follow-up | As clinic personnel, I want follow-up tasks and notes so that unresolved cases are not lost. | Medium | Implemented (source) |
| F49 | Closure and history | As an authorized reviewer, I want controlled closure and history so that the full incident lifecycle can be audited. | Medium | Implemented (source) |
| F50 | Incident authorization verification | As a security reviewer, I want role, ownership, state-transition, and direct-input tests so that incident data cannot be misused. | High | Deployment Verification |
| **MODULE 6 — Faculty & Staff Health Services** |  |  |  |  |
| F51 | Faculty and staff profiles | As clinic personnel, I want employee patient profiles separated by patient type so that institutional identity is mapped correctly. | High | Implemented (source) |
| F52 | Employee record search | As authorized clinic personnel, I want to search Faculty and Staff records so that I can locate the correct employee patient. | High | Implemented (source) |
| F53 | Employee own-record access | As a Faculty or Staff patient, I want to view only my own health record so that my privacy is preserved. | High | Implemented (source) |
| F54 | Employee clinical history | As a clinician, I want medical history, allergies, medication, immunization, and future laboratory results so that care reflects relevant risks. | High | Implemented (source) |
| F55 | Employee medical documents | As an authorized user, I want signed access to protected employee documents so that files remain private. | High | Implemented (source) |
| F56 | Clinic employee My Health | As a clinic employee linked to a Staff profile, I want a separate personal-health workspace so that employment access does not broaden access to my health data. | High | Implemented (source) |
| F57 | Employee consultation history | As a Faculty or Staff patient, I want scoped consultation history so that I can review my own completed visits. | High | Implemented (source) |
| F58 | Compliance, examinations, and sick leave | As authorized users, I want employee health-compliance records so that required health services can be monitored. | High | Implemented (source) |
| F59 | Institutional identity synchronization | As an administrator, I want local-first, insert-only Registrar or HR synchronization so that approved external records can be added without overwriting existing patients. | Low | Deferred |
| F60 | Employee ownership and privacy verification | As a security reviewer, I want patient-type, profile-link, ownership, and signed-document tests so that Faculty and Staff data remains isolated. | High | Deployment Verification |
| **MODULE 7 — School Health Program Monitoring** |  |  |  |  |
| F61 | Program proposal | As authorized clinic personnel, I want to propose a school health program so that planned activities enter a reviewed workflow. | Medium | Implemented (source) |
| F62 | Program approval | As an authorized approver, I want to approve or reject a proposal so that programs do not start without oversight. | High | Implemented (source) |
| F63 | Program catalog | As clinic personnel, I want a list of health programs and states so that current activities are visible. | Medium | Implemented (source) |
| F64 | Participant enrollment | As authorized personnel, I want to enroll eligible participants so that program scope is recorded. | High | Implemented (source) |
| F65 | Program scheduling | As program personnel, I want schedules and sessions so that activities can be coordinated. | Medium | Implemented (source) |
| F66 | Screening activities | As authorized personnel, I want screening outcomes recorded so that program health checks are traceable. | High | Implemented (source) |
| F67 | Immunization activities | As authorized personnel, I want immunization participation recorded so that preventive-care delivery can be monitored. | High | Implemented (source) |
| F68 | Progress monitoring | As clinic personnel, I want participation and outcome status so that incomplete program work is visible. | Medium | Implemented (source) |
| F69 | Program reports | As authorized personnel, I want aggregate program reports so that effectiveness and coverage can be reviewed without unnecessary PHI. | Medium | Implemented (source) |
| F70 | Program approval and security verification | As a release reviewer, I want approval-RPC, participant-scope, and role tests so that unauthorized users cannot change program state. | High | Deployment Verification |
| **MODULE 8 — Health Clearance and Certification** |  |  |  |  |
| F71 | Clearance request | As an eligible patient, I want to request a health clearance so that the clinic can evaluate my requirements. | High | Implemented (source) |
| F72 | Clearance requirements | As clinic personnel, I want configurable requirements so that each clearance type has explicit evidence criteria. | High | Implemented (source) |
| F73 | Clearance templates | As authorized personnel, I want controlled templates so that issued documents remain consistent. | Medium | Implemented (source) |
| F74 | Supporting documents | As a patient or clinic user, I want protected supporting-document submission and review so that evidence remains private. | High | Implemented (source) |
| F75 | Compliance evaluation | As clinic personnel, I want requirement completion tracked so that missing evidence is visible before issuance. | High | Implemented (source) |
| F76 | Clinical evaluation | As an authorized clinician, I want to record clearance findings so that issuance is based on reviewed health information. | High | Implemented (source) |
| F77 | Certificate issuance | As authorized personnel, I want controlled certificate issuance so that only approved clearances produce documents. | High | Implemented (source) |
| F78 | Clearance history | As an authorized user, I want status and issuance history so that prior decisions remain traceable. | Medium | Implemented (source) |
| F79 | Patient clearance access | As a Student, Faculty member, or Staff member, I want to see only my own requests and history so that I can monitor progress privately. | High | Implemented (source) |
| F80 | Signed-document and Storage hardening | As a security reviewer, I want ownership, MIME, malware, signed-URL, expiry, deletion, and download-audit controls so that clearance files are safe to use. | High | Ready |
| **MODULE 9 — Reporting and Compliance** |  |  |  |  |
| F81 | Role-scoped dashboards | As an Admin, Doctor, or Nurse, I want aggregates limited to my authorized scope so that dashboards do not reveal unrelated patients. | High | Implemented (source) |
| F82 | Daily activity metrics | As clinic personnel, I want bounded consultation and channel trends so that workload can be monitored. | Medium | Implemented (source) |
| F83 | Consultation reports | As an authorized clinician, I want status and visit-reason reports so that clinical operations can be reviewed. | Medium | Implemented (source) |
| F84 | Medicine reports | As authorized personnel, I want stock and dispensing aggregates so that pharmacy operations can be reconciled. | Medium | Implemented (source) |
| F85 | Clearance and program reports | As authorized personnel, I want aggregate clearance and program outcomes so that institutional obligations can be monitored. | Medium | Implemented (source) |
| F86 | Administrative workbook exports | As an Admin, I want queued aggregate workbooks in private Storage so that approved reports can be downloaded without exposing raw tables. | High | Deployment Verification |
| F87 | Export security and completion audit | As a security reviewer, I want authorization, assignment scope, CSV-injection, formula, expiry, and large-data tests so that exports are safe and accurate. | High | Ready |
| F88 | Audit reliability and observability | As an operational owner, I want mandatory events, protected logs, alerts, and incident runbooks so that failures and misuse can be detected. | High | Ready |
| F89 | Reproducible schema and migrations | As a release engineer, I want reviewed views, RPCs, migrations, grants, and advisor evidence so that a clean environment can be reproduced safely. | High | Current Sprint |
| F90 | Current-system documentation baseline | As a project owner, I want source-based documentation that records release, backup, and recovery gaps so that current evidence is auditable without implying those controls are implemented. | High | Implemented (source) |
| **MODULE 10 — User Access & Confidentiality Control** |  |  |  |  |
| F91 | Authentication | As a user, I want server-validated login and logout so that credentials and sessions are handled through approved boundaries. | High | Implemented (source) |
| F92 | Active sessions and role routing | As an authenticated user, I want active-session validation and routing to my assigned portal so that revoked or mismatched access is denied. | High | Implemented (source) |
| F93 | Access administration and profile settings | As an Admin or user, I want controlled roles, permissions, approvals, recovery, and self-editable settings so that protected identity fields cannot be changed casually. | High | Ready |
| F94 | Server-first authorization | As a security reviewer, I want every action to validate role, ownership or assignment, input, origin, and minimized output so that browser manipulation cannot bypass access control. | High | Implemented (source) |
| F95 | Supabase authorization verification | As a release reviewer, I want RLS, grants, views, RPCs, Storage, Realtime, and six-role isolation tested in the target environment so that authentication is not mistaken for authorization. | High | Current Sprint |
| F96 | Privileged authentication controls | As a security owner, I want MFA, reauthentication, secure recovery, short sessions, and rapid revocation so that privileged-account compromise has limited impact. | High | Ready |
| F97 | Distributed abuse prevention | As a security owner, I want atomic rate limits and safe proxy handling so that login, RFID, appointment, and export endpoints resist abuse across multiple instances. | High | Ready |
| F98 | CSP, secrets, and fail-closed PHI handling | As a security owner, I want production CSP and managed server-only secrets with no fallback so that injection and secret exposure risks are reduced. | High | Current Sprint |
| F99 | Privacy operations and external AI governance | As a privacy owner, I want approved purposes, retention, rights handling, provider terms, minimization, and a non-AI path so that sensitive data use remains accountable. | High | Policy Decision |
| F100 | Six-role quality and security verification | As a release reviewer, I want automated, browser, accessibility, performance, and negative-access tests for all six roles so that source completion is not confused with safe deployment. | High | Current Sprint |

## Current sprint commitments

Sprint 6 is detailed in [SPRINT.md](SPRINT.md).

| User Story No. | Features/Task | Module | Priority | Status |
| --- | --- | --- | --- | --- |
| F90 | Documentation baseline | Reporting and Compliance | High | Implemented (source) |
| F89 | Database reproducibility | Reporting and Compliance | High | Current Sprint |
| F95 | Supabase authorization verification | User Access & Confidentiality Control | High | Current Sprint |
| F40 | Staff appointment ownership repair | Appointment Scheduling System | High | Current Sprint |
| F100 | Critical workflow test coverage | User Access & Confidentiality Control | High | Current Sprint |
| F98 | Fail-closed PHI secret handling | User Access & Confidentiality Control | High | Current Sprint |

### Microservices migration traceability

The 2026-08-17 extraction does not create a new catalog ID or an eleventh
product module.
It is an architectural implementation spanning the existing F1-F100 catalog:
Identity maps primarily to F91-F96; Appointment to F31-F40; Clinical to the
clinical capabilities in Modules 1, 2, 5, 6, 7, and 8; Inventory to F21-F30;
Notification to cross-cutting reminder work; Reporting to F81-F90; and AI to
the policy-dependent portions of F36 and F99.

The local backend source, API client, Render Blueprint, and inventory RPC are
implemented. Deployment, call-site cutover, database application, browser
verification, and cloud operations remain `Deployment Verification`. See the
[migration report](docs/MICROSERVICES_MIGRATION_REPORT.md).

## Open-work requirements

### F8, F9, F20, F36, and F59 — Deferred or policy-dependent capabilities

- The longitudinal timeline must use authorized existing records, define
  grouping and filtering, and remain bounded for large histories.
- Bulk import requires validated mappings, a dry run, duplicate handling,
  audit evidence, and rollback; it must never overwrite an existing patient
  silently.
- Dedicated laboratory results require ordering, result entry, reference
  ranges, attachments, amendments, and clinician acknowledgment.
- Clinical decision support and external AI require a clinical safety case,
  human override, prohibited-use rules, provider privacy review, and a non-AI
  workflow.
- Registrar or HR synchronization remains local-first and insert-only. It
  requires an approved authoritative-source contract, authentication, mapping,
  reconciliation, deactivation, failure handling, and immutable external IDs.

### F30 — Inventory verification

- Test Admin and Nurse receipt of an approved zero-stock catalog medicine.
- Reload Doctor inventory and prescription availability from the shared stock
  source.
- Test concurrent receipt and dispensing, idempotent request IDs, stock floors,
  audit delivery, expiry validation, and retry behavior.
- Keep dispensing, receipt, adjustment, and restocking synchronous and atomic;
  a future worker may notify but must not change stock automatically.

### F40 — Staff appointment ownership repair

- Centralize patient-role to profile-table and foreign-key mapping.
- Use `staff` and `staff_id` for Staff appointment history and cancellation.
- Extend appointment DTOs to include `patient_type: "staff"`.
- Review reminder and notification helpers for the same two-role assumption.
- Add Student, Faculty, Staff, own-record, and cross-record denial tests.

**Acceptance:** Staff can list and cancel only their own eligible appointments;
Student and Faculty behavior remains unchanged; supplied foreign identifiers do
not bypass ownership.

### F50, F60, and F70 — Module authorization verification

- Test positive and negative role paths, direct object identifiers, invalid
  workflow states, and assignment or ownership boundaries.
- Verify privileged RPC execution grants, `search_path`, caller checks, and
  transaction behavior in a non-production target.
- Keep Realtime payloads limited to private invalidation markers rather than
  incident, employee-health, or program clinical data.

### F80 and F87 — Storage and export hardening

- Verify all intended private medical and compliance buckets, per-object
  ownership, file-size limits, MIME and signature validation, malware scanning,
  deletion, short signed URLs, and download auditing.
- Review every report, template, checklist, and export for real data,
  authorization, assignment scope, formula accuracy, empty states, large-data
  behavior, CSV injection protection, and PHI-safe handling.
- Add PDF only where a defined operational requirement exists.

### F88 — Audit reliability, monitoring, and incident response

- Inventory mandatory security-sensitive events and make critical delivery
  transactional or outbox-backed.
- Protect audit data from ordinary mutation, define retention and review, and
  alert when required writes fail.
- Configure protected application and Supabase log drains, uptime checks,
  dashboards, clock synchronization, escalation ownership, and tested breach,
  downtime, and evidence-preservation runbooks.

### F89 — Database reproducibility and historical cleanup

- Compare local and target migration history before any production mutation.
- Capture reviewed definitions for all application-facing views and RPCs.
- Verify view security, object grants, RLS, function ownership, `search_path`,
  execution privileges, migrations, seeds, and database advisors in staging.
- Retire historical objects only after live view, function, foreign-key,
  export, and rollback dependencies are proven absent.

**Acceptance:** A clean non-production environment can be built from reviewed,
version-controlled files; failed or unavailable checks remain explicitly
unverified.

### F90 — Release, backup, recovery, and documentation controls

- The source-based documentation baseline is complete; the operational release,
  backup, and recovery controls below remain open and must not be described as
  implemented.
- Keep README, architecture, backlog, sprint, and completed history aligned to
  current source and the ten canonical submodules.
- Add protected CI for TypeScript, ESLint, tests, migration validation, secret
  and dependency scanning, and `git diff --check`.
- Define staging promotion, approvals, rollback, migration ordering, release
  evidence, recovery-point and recovery-time objectives, encrypted backups,
  restore exercises, downtime operation, and deletion propagation.

### F93 and F96 — Access administration and privileged authentication

- Reconcile the role and permission catalog with fixed route prefixes and
  explicit Server Action role lists while retaining default deny.
- Complete self-service profile settings; separate editable contacts from
  protected identity, employment, role, and clinical fields and audit sensitive
  changes.
- Require MFA for clinic roles, privileged reauthentication, secure recovery,
  reviewed session lifetimes, periodic access review, and rapid offboarding
  revocation.

### F95 — Supabase authorization verification

- Inventory grants in exposed schemas and confirm RLS on each intended Data API
  object.
- Test Student, Faculty, and Staff ownership plus Doctor and Nurse assignment
  isolation across lists, details, reports, actions, views, RPCs, and signed
  URLs.
- Inspect every privileged function owner, `search_path`, internal caller
  checks, default `PUBLIC` execution, and explicit grant.
- Verify private Realtime topics, Storage policies, and that service-role keys
  are absent from browser assets.

**Acceptance:** Positive and negative tests pass for all six roles;
`authenticated` alone never grants object access; views and privileged RPCs do
not bypass intended row and workflow rules.

### F97 and F98 — Abuse prevention, CSP, and secrets

- Replace process-local rate limiting with an atomic shared store for login,
  appointment, RFID, exports, and other abuse-sensitive actions. Define proxy
  IP trust, failure behavior, reset headers, and concurrency tests.
- Remove production `unsafe-eval` and reduce `unsafe-inline` through compatible
  nonces or hashes; verify login, charts, dialogs, themes, Realtime, and builds.
- Remove the fallback from `lib/crypto-phi.ts`, fail clearly when the managed
  key is absent, keep it server-only, design rotation, and scan source, history,
  configuration, and built assets for secrets.

**Acceptance:** No production path silently uses a default encryption secret;
no secret is exposed through `NEXT_PUBLIC_` or client bundles; documentation
does not claim clinical columns are application-encrypted until integration is
implemented and verified.

### F99 — Privacy and AI governance

- Approve data inventory, lawful bases, notice, retention, legal holds,
  correction and deletion, data-subject requests, backup retention, training,
  physical safeguards, and accountable privacy/security/clinical owners.
- Keep real-patient external AI disabled until minimization, retention and
  training terms, subprocessors, location, deletion, security review, and the
  required processing agreement are approved.

### F100 — Six-role release verification

- Cover login, routing, logout, RFID, consultation concurrency and authority,
  appointment ownership, patient own-record denial tests, signed attachments,
  dashboards, reports, and inventory transactions.
- Run WCAG 2.2 AA keyboard, focus, name/role/value, contrast, screen-reader,
  reduced-motion, zoom, table, dialog, chart, file-preview, and tablet checks.
- Measure large-data dashboard, record, history, report, and attachment paths;
  add indexes only from reviewed query plans and establish performance budgets.
- Record the tested environment and exact blockers; no failure or timeout is a
  passing result.

## Backlog intake and completion rules

A new story must identify the user or operational outcome, affected roles and
data scope, privacy and security impact, dependencies, acceptance criteria, and
verification method. Additions must preserve the ten-module catalog: extend an
existing story or approve a documented numbering revision rather than creating
an unowned technical bucket.

A story is recorded in [COMPLETED_SPRINTS.md](COMPLETED_SPRINTS.md) only when
the source and stated local checks exist. Deployment-dependent work remains
explicitly unverified until tested against an authorized environment.
