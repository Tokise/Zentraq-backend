# Server action map

All database access lives in this directory. Route components must import an
action from here; they must not query Supabase directly.

- `admin/` — administrator-only workflows grouped by domain: `access/`,
  `accounts/`, `appointments/`, `clearances/`, `documents/`, `incidents/`,
  `medicine/`, `records/`, `rfid/`, and `visits/`.
- `student/`, `faculty/` — self-service profile and role-specific workflows.
- `clinical/` — records, visits, clearances, incidents, and prescriptions.
- `scheduling/` — appointment requests, review, and scheduling decisions.
- `inventory/` — medicine workflow queues and health-program data.
- `reports/` — reporting and analytics queries.
- `rfid/` — kiosk-specific workflows.
- `system/` — authentication, user notifications, and dashboard support.

Every action must retain its authentication, role validation, input validation,
DTO shaping, and audit logging at the action boundary.
