# Zentraq

Zentraq is a role-based school clinic and health-management system for managing
patient records, consultations, appointments, RFID-assisted check-in, medicine
inventory, incidents, health programs, clearances, reporting, and patient
self-service. The current portals serve administrators, doctors, nurses,
students, faculty members, and staff.

Zentraq is in an incremental two-repository microservices migration. This
repository remains the Next.js frontend and working backend-for-frontend while
`zentraq-backend` contains a separately runnable API Gateway plus Identity,
Appointment, Clinical, Inventory, Notification, Reporting, and AI services.
Supabase remains the shared Auth, PostgreSQL, Storage, Realtime, and RPC
platform. Existing Server Actions and focused Supabase Edge Functions remain
active until equivalent gateway paths are deployed and verified for all six
roles; source extraction alone is not a safe cutover signal.

## Core capabilities

- Student, faculty, staff, and clinic-employee medical records
- Walk-in, appointment, and RFID-assisted clinic visits
- Nurse triage and handoff, with doctor or admin final consultation review
- Searchable, reusable visit reasons backed by `patient_complaint`
- Appointment requests, schedules, reminders, rescheduling, and staff workload
- Medicine stock, dispensing, expiry, alerts, and restock workflows
- Incident reporting, referrals, follow-ups, and status tracking
- Health programs, screenings, participants, and compliance records
- Health-clearance requests, evaluation, certificates, and history
- Role-scoped dashboards, reports, notifications, and audit records
- Patient self-service for appointments, records, consultations, and clearances

## Roles

| Role | Primary use |
| --- | --- |
| Admin | Clinic-wide operations, access administration, reporting, and approved clinical workflows |
| Doctor | Assigned consultations, diagnosis, treatment, prescriptions, follow-ups, and clinical review |
| Nurse | Assigned visits, triage, handoff, appointments, dispensing, incidents, and clinic operations |
| Student | Own appointments, health record, consultations, incidents, and clearances |
| Faculty | Own appointments, health record, consultations, incidents, and clearances |
| Staff | Own appointments, health record, consultations, and clearances |

## Technology

Versions below come from the current `package.json`.

| Area | Technology |
| --- | --- |
| Framework | Next.js 16.3.0, App Router |
| UI runtime | React 19.2.8, React DOM 19.2.8 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI primitives | Base UI 1.6.0, Radix Tabs 1.1.21, shadcn configuration |
| Data platform | Supabase JS and SSR for frontend Auth; PostgreSQL, Storage, RPCs, Queues, Cron, and retained Edge Functions owned from zentraq-backend |
| Validation | Zod 4.4.3 |
| Charts | Recharts 3.8.0 |
| Dates and icons | date-fns 4.4.0, Lucide React 1.24.0 |
| Notifications | Sonner 2.0.7 and Supabase private Realtime broadcasts |
| Backend migration | Node.js 22, Express 5, pnpm workspaces, Vitest, and manually managed Render services in `zentraq-backend` |

The local Supabase configuration targets PostgreSQL 17. A deployed project may
differ and must be checked before applying migrations.

## Local development

### Prerequisites

- Node.js 22.0.0 or newer, as required by the installed Supabase JS package
- [pnpm](https://pnpm.io/installation)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

### Setup

```bash
git clone <repository-url>
cd zentraq
pnpm install
supabase start
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Supabase CLI prints the
local API URL, publishable key, and server-only service-role key after startup.

### Environment variables

Create `.env.local` in the project root. Use values from the local Supabase
output or the corresponding deployment secret manager.

```env
# Safe to expose to the browser
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-local-publishable-key

# Server-only; never use a NEXT_PUBLIC_ prefix
SUPABASE_SERVICE_ROLE=replace-with-local-service-role-key
BACKEND_URL=http://localhost:4000

# Optional appointment decision-support provider
AI_PROVIDER=replace-with-openrouter-api-key
OPENROUTER_MODEL=google/gemma-4-31b-it:free
AI_TIMEOUT_MS=10000
AI_MAX_TOKENS=512

# Required before application-level PHI encryption is enabled
PHI_ENCRYPTION_KEY=replace-with-a-managed-random-secret
```

`SUPABASE_SERVICE_ROLE_KEY` is accepted as a legacy server-only alternative to
`SUPABASE_SERVICE_ROLE`. Never place a service-role key, AI key, encryption key,
or other secret in a `NEXT_PUBLIC_` variable; Next.js includes those variables
in browser bundles.

The PHI encryption helper now fails closed unless a managed server-only key of
at least 32 characters is configured. It is still not integrated into clinical
persistence, so the source does not claim application-level encryption of
clinical columns. Field selection, versioned ciphertext, key rotation, backup,
recovery, and data migrations remain separate reviewed work.

## Project structure

```text
actions/       Server Actions grouped by business domain
app/           Next.js pages, layouts, loading, and error boundaries
components/    Shared UI and domain workspaces
constants/     Shared application constants
docs/          Architecture and technical documentation
lib/           Auth, API client, security, validation, DTO, masking, and utilities
services/      AI, audit, and notification services
supabase/      Local configuration, migrations, and seed data
types/         Shared application and DTO types
utils/         Supabase clients and general utilities
proxy.ts       Session validation and top-level route authorization
next.config.ts Response security headers and Next.js configuration
```

## Documentation

- [Software Architecture Document](docs/SOFTWARE_ARCHITECTURE_DOCUMENT.md)
- [Serverless MicroServices](docs/SERVERLESS_MICROSERVICES_MIGRATION.md)
- [Testing Strategy](docs/TESTING_STRATEGY.md)
- [Microservices Migration Report](docs/MICROSERVICES_MIGRATION_REPORT.md)
- [Render API migration status](docs/RENDER_API_MIGRATION_STATUS.md)
- [Server action boundaries](actions/README.md)
- [Current sprint](SPRINT.md)
- [Completed sprints](COMPLETED_SPRINTS.md)
- [Backlog](BACKLOG.md)

## Verification and compliance boundary

Repository documentation describes the current source tree. It does not prove
that every migration is applied, every RLS policy or grant is active in a
deployed Supabase project, or every operational safeguard is in place. Validate
the target database, role paths, storage policies, backups, logging, and secrets
before deployment.

The local `zentraq-backend` repository and its Render Blueprint are
source-implemented and locally verified, but no GitHub remote, Render service,
Vercel rewrite, or target Supabase migration is claimed deployed by this
repository. Frontend clinic call sites intentionally retain their working
Server Action paths until the replacement services pass staging and six-role
end-to-end verification.

Zentraq handles health and identity information. The documented controls and
HIPAA/Philippine Data Privacy Act mappings are engineering guidance, not legal
advice, certification, or a claim of compliance. Compliance also depends on the
deploying organization, contracts, policies, workforce practices, physical
safeguards, incident response, retention, and jurisdiction-specific review.
