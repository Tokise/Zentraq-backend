# Performance and Reporting Implementation

The backend source now defines service-role-only session validation,
transactional session establishment, and a bounded dashboard snapshot RPC. The
reporting service exposes explicit generation phases and download readiness,
drains durable queues at startup and periodically, and retains immediate drains
after enqueue.

`render.yaml` assigns paid warm instances to the API gateway and reporting
service while keeping the remaining services on the free plan. All services are
declared in the Singapore region to avoid cross-region service traffic.

These are source changes, not deployment evidence. The Supabase migration must
not be applied until remote migration history is reconciled. Render plan changes
must be reviewed for cost and deployed deliberately, followed by queue-to-
Storage-to-download acceptance testing.

## 2026-08-29 clinic dashboard RPC repair

The August 28 performance SQL was applied manually to the live project. A
read-only, PHI-minimized check found active Admin, Doctor, and Nurse accounts
with assigned consultations or appointments, but all three snapshot calls
failed with PostgreSQL error `42703`. The deployed
`v_appointment_overview` exposes scheduling and patient-name fields but not
`reason`, while `get_dashboard_snapshot_v1()` selected
`appointment.reason`. The snapshot also calls
`get_clinician_workload_stats(uuid, text)`, which is absent from the deployed
API schema because its earlier migration was not applied.

`20260829114212_repair_dashboard_snapshot.sql` is a self-contained repair. It
creates the missing workload function and replaces the snapshot function while
preserving its public name, parameters, assignment filters, bounds, Manila date
handling, and JSON contract. Appointment reasons are resolved by joining the
view row to `public.appointments` by ID. Both functions use an empty
`search_path`, schema-qualified relations, and service-role-only execution.

Because the remote ledger still diverges from source, this repair was not
deployed with `supabase db push` and no migration-history edits were made. On
2026-08-29, the reviewed file was applied alone to the confirmed Zentraq project
through `supabase db query --linked --project-ref`. PHI-minimized live checks
then returned the expected dashboard keys and assigned row counts for one
active Admin, Doctor, and Nurse account. An anonymous call was denied with
PostgreSQL error `42501`. The post-deployment Security Advisor reported zero
warnings for the two repaired functions; 14 pre-existing project-level security
warnings remain outside this repair. Authenticated UI acceptance and frontend
deployment remain pending and must not be inferred from these database checks.
