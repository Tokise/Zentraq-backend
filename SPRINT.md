# Zentraq Current Sprint

## Sprint 6 — Release Hardening and Verification

**Dates:** 2026-08-11 to 2026-08-17

**Goal:** Turn the current source-complete clinical system into a reproducible,
security-reviewed release candidate by closing known database, authorization,
patient-workflow, testing, and secret-management blockers.

This sprint does not add new clinical modules. It verifies and hardens the
workflows already documented in the
[Software Architecture Document](docs/SOFTWARE_ARCHITECTURE_DOCUMENT.md).

## Sprint status

| ID | Commitment | Points | Status |
| --- | --- | ---: | --- |
| ZQ-200 | Rewrite README, architecture, backlog, sprint, and completed-history documentation from current source | 3 | Completed |
| ZQ-201 | Reproduce and verify the Supabase schema, views, migrations, and RPC signatures | 8 | Ready |
| ZQ-202 | Verify role isolation, RLS, grants, privileged functions, Storage, and Realtime policies | 8 | Ready |
| ZQ-203 | Fix staff appointment history and cancellation ownership mapping | 3 | Ready |
| ZQ-204 | Add and run critical automated and browser workflow tests for all six roles | 8 | Ready |
| ZQ-205 | Remove the PHI encryption fallback and enforce managed secret configuration | 5 | Ready |
| **Total** |  | **35** |  |

## ZQ-200 — Current-system documentation baseline

### Deliverables

- [x] Replace the README with a concise system overview, safe setup, and links.
- [x] Rewrite the architecture document around the current service boundaries,
      database catalog, roles, privacy, and security.
- [x] Remove stale routes, schemas, framework versions, and encoding corruption
      from the primary documentation.
- [x] Reclassify implemented work, active work, and deferred work across the
      backlog and sprint history.
- [x] Perform final cross-document link, terminology, and whitespace checks.

### Acceptance criteria

- Only documentation files are changed by this item.
- Documentation distinguishes source evidence, local migration evidence,
  deployed verification, and operational compliance.
- `patient_complaint` is canonical; historical names appear only when explaining
  compatibility history.

## ZQ-201 — Database reproducibility

### Problem

Current code references nine views whose complete `CREATE VIEW` definitions were
not found in the reviewed local migration set. The target project may also have
different migration, function, or grant state. A prior environment reported
`public.complaints` missing while applying consultation-catalog SQL.

### Tasks

- [ ] Check Supabase CLI version and discover commands through `--help`.
- [ ] Compare local and target migration histories without modifying production.
- [ ] Confirm `consultations.patient_complaint` and `public.complaints` exist in
      the target schema before running dependent SQL.
- [ ] Capture reviewed definitions for:
  - `v_appointment_overview`
  - `v_patient_medical_record`
  - `v_consultation_summary`
  - `v_medicine_stock_summary`
  - `v_complaint_frequency`
  - `v_dispensing_summary`
  - `v_clearance_completion`
  - `v_daily_consultations`
  - `v_rfid_patient_profiles`
- [ ] Make app-facing views `security_invoker` where supported, or protect them
      with explicit grants and safe underlying access.
- [ ] Verify the four application RPC contracts:
  - `check_in_rfid`
  - `claim_consultation`
  - `finalize_consultation_workflow`
  - `approve_health_program`
- [ ] Run migrations against a disposable/staging database in order.
- [ ] Run database advisors and record unresolved findings.
- [ ] Verify seed behavior without copying production PHI.

### Acceptance criteria

- A clean non-production environment can be built from version-controlled files.
- All nine views and four RPCs have reviewed, versioned definitions/signatures.
- The complaint migration works whether the compatible catalog already exists or
  must be created.
- Migration list and advisor output are recorded; timeouts or unavailable tools
  remain explicitly unverified.

## ZQ-202 — Authorization and Supabase security verification

### Tasks

- [ ] Inventory every table/view grant in exposed schemas.
- [ ] Confirm RLS is enabled on every intended Data API object.
- [ ] Test ownership policies for student, faculty, and staff records.
- [ ] Test assignment isolation for doctor and nurse queues, details, histories,
      dashboards, reports, and direct action inputs.
- [ ] Test admin clinic-wide access only where intentionally implemented.
- [ ] Inspect every `SECURITY DEFINER` function owner, `search_path`, internal
      `auth.uid()`/role checks, default `PUBLIC` execution, and explicit grants.
- [ ] Verify private Realtime topics reject unauthorized subscribers and contain
      no clinical payload.
- [ ] Verify private medical buckets and public announcement media policies.
- [ ] Confirm service-role keys remain server-only and are absent from built
      client assets.

### Acceptance criteria

- Positive and negative tests pass for all six roles.
- An authenticated user cannot gain access merely because an object is granted
  to `authenticated`.
- Views do not bypass intended row policies.
- Privileged RPCs reject unauthorized roles and invalid workflow states.
- Storage and Realtime behavior matches the architecture document.

## ZQ-203 — Staff appointment ownership repair

### Problem

Appointment creation correctly maps staff to `staff` and `staff_id`, but the
current `getMyAppointments` and `cancelAppointment` actions resolve every
non-student through `faculty` and `faculty_id`.

### Tasks

- [ ] Centralize patient-role to profile-table and foreign-key mapping.
- [ ] Use `staff`/`staff_id` for staff appointment history and cancellation.
- [ ] Extend appointment DTO types to include `patient_type: "staff"`.
- [ ] Review reminder/notification helpers for the same two-role assumption.
- [ ] Add ownership tests for student, faculty, and staff.

### Acceptance criteria

- Staff can list and cancel only their own eligible appointments.
- Student and faculty behavior remains unchanged.
- Supplying another profile or appointment ID does not bypass ownership.

## ZQ-204 — Critical-flow test coverage

### Automated coverage

- [ ] Login, role redirect, invalidated session, and logout.
- [ ] RFID lookup, duplicate check-in protection, queue invalidation, and claim
      race behavior.
- [ ] Consultation tabs, visit reason search/Other validation, nurse handoff,
      doctor/admin final review, and catalog deduplication.
- [ ] Visit and history tables with 0, 1, 10, and 11 rows.
- [ ] Patient booking, slot conflict, staff history/cancellation, staff review,
      and AI success/fallback behavior.
- [ ] Own-record access and cross-patient denial for student, faculty, and staff.
- [ ] Signed attachment authorization and expiry.
- [ ] Dashboard/report assignment scope and all six clinical activity series.

### Browser and accessibility smoke matrix

| Role | Minimum browser paths |
| --- | --- |
| Admin | Dashboard, records, visits/history, appointments, reports, access control, RFID registration |
| Doctor | Dashboard, assigned records/visits/history, final review, appointments, clearances, reports |
| Nurse | Dashboard, assigned visits/history, handoff, appointments, medicine, incidents, reports |
| Student | Dashboard, appointment, own record/history, incident report, clearance |
| Faculty | Dashboard, appointment, own record/history, incident report, clearance |
| Staff | Dashboard, appointment/history/cancel, own record/history, clearance |

For each path, verify keyboard order, visible focus, control names, empty/loading/
error states, responsive layout, and absence of console/runtime errors.

### Acceptance criteria

- Critical automated checks pass in CI or have a recorded environment blocker.
- Role-by-role browser results identify the tested environment and account scope.
- No failed or timed-out check is described as passing.

## ZQ-205 — Fail-closed PHI secret handling

### Tasks

- [ ] Remove the hardcoded fallback from `lib/crypto-phi.ts`.
- [ ] Fail startup or helper invocation clearly when a required key is absent.
- [ ] Use a managed, random, server-only key with a documented rotation design.
- [ ] Confirm the helper is still unused before changing any stored format.
- [ ] Do not encrypt existing columns until field selection, migration, search,
      rotation, backup, and recovery behavior are approved.
- [ ] Scan source, history, configuration, and built assets for exposed secrets.

### Acceptance criteria

- No production path can silently use a default encryption secret.
- No secret is exposed through a `NEXT_PUBLIC_` variable or client bundle.
- The change does not falsely claim that clinical columns are application-level
  encrypted when the helper is not integrated.

## Definition of done

- All six sprint items meet their acceptance criteria.
- TypeScript, focused ESLint, automated tests, migration verification, Supabase
  advisors, secret scanning, and `git diff --check` pass where available.
- Browser smoke results cover all roles and explicitly record environment limits.
- No application-facing view or privileged RPC remains definition-unknown.
- High-severity open findings have an owner and are either fixed or explicitly
  accepted by the appropriate security/privacy/clinical authority.
- [BACKLOG.md](BACKLOG.md), [COMPLETED_SPRINTS.md](COMPLETED_SPRINTS.md), the
  README, and architecture document reflect the final sprint outcome.

## Risks and controls

| Risk | Control |
| --- | --- |
| Target migrations differ from local history | Inspect first, stage changes, back up, and never repair production blindly |
| Privileged function tests modify clinical data | Use disposable test identities and non-production fixtures |
| Hardening breaks role workflows | Run positive and negative tests for all six roles before promotion |
| Security work expands beyond one week | Keep release blockers in scope and return non-blockers to the prioritized backlog |
| Environment or network unavailable | Record the exact blocker and do not mark the item verified |

## Out of scope for Sprint 6

- New clinical modules or autonomous AI behavior
- Bulk imports, external identity synchronization, SMS/email providers, PWA/
  offline mode, internationalization, laboratory workflows, or a new timeline UI
- Destructive cleanup of historical database objects before live dependency
  analysis
- A claim of HIPAA or Philippine Data Privacy Act certification
