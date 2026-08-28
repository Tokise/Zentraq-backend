# Render Environment Variables

Use the exact variable names below. Add real values only in the Render
Dashboard; commit placeholders only.

All free-plan components are Render Web Services. Their public
`onrender.com` hostnames are not an authorization boundary. Domain services
still require a valid signed internal context, and machine-only routes require
`INTERNAL_SERVICE_KEY`.

## Shared secret values

Generate two different values with at least 32 random bytes:

- `INTERNAL_CONTEXT_SECRET`: gateway signs user context; every domain service
  verifies it.
- `INTERNAL_SERVICE_KEY`: protects service-to-service machine endpoints.

Use the same context secret across the gateway and domain services. Use the
same service key only while the current shared-key design remains in place.
Do not reuse either value as a Supabase, Vercel, or user-session secret.

PowerShell compatible with older .NET versions:

```powershell
$bytes = New-Object byte[] 32
$rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
$rng.GetBytes($bytes)
$rng.Dispose()
-join ($bytes | ForEach-Object { $_.ToString("x2") })
```

Run the command twice and store the outputs separately.

## API Gateway

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://YOUR_VERCEL_DOMAIN
INTERNAL_CONTEXT_SECRET=REPLACE_WITH_CONTEXT_SECRET
INTERNAL_SERVICE_KEY=REPLACE_WITH_SERVICE_KEY
SERVICE_TIMEOUT_MS=8000
IDENTITY_SERVICE_URL=https://YOUR_IDENTITY_SERVICE.onrender.com
CLINICAL_SERVICE_URL=https://YOUR_CLINICAL_SERVICE.onrender.com
APPOINTMENT_SERVICE_URL=https://YOUR_APPOINTMENT_SERVICE.onrender.com
INVENTORY_SERVICE_URL=https://YOUR_INVENTORY_SERVICE.onrender.com
NOTIFICATION_SERVICE_URL=https://YOUR_NOTIFICATION_SERVICE.onrender.com
REPORTING_SERVICE_URL=https://YOUR_REPORTING_SERVICE.onrender.com
AI_SERVICE_URL=https://YOUR_AI_SERVICE.onrender.com
```

The gateway does not receive a Supabase secret key. It forwards the user
bearer token to services that need user-scoped RLS.

## Identity Service

```env
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=REPLACE_WITH_SERVER_ONLY_SECRET_KEY
INTERNAL_CONTEXT_SECRET=REPLACE_WITH_CONTEXT_SECRET
INTERNAL_SERVICE_KEY=REPLACE_WITH_SERVICE_KEY
```

## Clinical Service

```env
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=REPLACE_WITH_SERVER_ONLY_SECRET_KEY
INTERNAL_CONTEXT_SECRET=REPLACE_WITH_CONTEXT_SECRET
INTERNAL_SERVICE_KEY=REPLACE_WITH_SERVICE_KEY
IDENTITY_SERVICE_URL=https://YOUR_IDENTITY_SERVICE.onrender.com
REPORTING_SERVICE_URL=https://YOUR_REPORTING_SERVICE.onrender.com
SERVICE_TIMEOUT_MS=8000
```

The publishable key plus forwarded user token is used for RFID Edge Function
execution. The secret key is used only for explicitly privileged clinical
queries and short-lived private profile-photo URLs.

## Appointment Service

```env
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=REPLACE_WITH_SERVER_ONLY_SECRET_KEY
INTERNAL_CONTEXT_SECRET=REPLACE_WITH_CONTEXT_SECRET
INTERNAL_SERVICE_KEY=REPLACE_WITH_SERVICE_KEY
IDENTITY_SERVICE_URL=https://YOUR_IDENTITY_SERVICE.onrender.com
NOTIFICATION_SERVICE_URL=https://YOUR_NOTIFICATION_SERVICE.onrender.com
REPORTING_SERVICE_URL=https://YOUR_REPORTING_SERVICE.onrender.com
SERVICE_TIMEOUT_MS=8000
```

## Inventory Service

```env
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=REPLACE_WITH_SERVER_ONLY_SECRET_KEY
INTERNAL_CONTEXT_SECRET=REPLACE_WITH_CONTEXT_SECRET
INTERNAL_SERVICE_KEY=REPLACE_WITH_SERVICE_KEY
REPORTING_SERVICE_URL=https://YOUR_REPORTING_SERVICE.onrender.com
SERVICE_TIMEOUT_MS=8000
```

## Notification Service

```env
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=REPLACE_WITH_SERVER_ONLY_SECRET_KEY
INTERNAL_CONTEXT_SECRET=REPLACE_WITH_CONTEXT_SECRET
INTERNAL_SERVICE_KEY=REPLACE_WITH_SERVICE_KEY
```

The publishable key plus forwarded user token is used for notification
list/read operations under RLS. The secret key is restricted to enqueue/status
RPCs and temporary compatibility service writes.

## Reporting Service

```env
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=REPLACE_WITH_SERVER_ONLY_SECRET_KEY
INTERNAL_CONTEXT_SECRET=REPLACE_WITH_CONTEXT_SECRET
INTERNAL_SERVICE_KEY=REPLACE_WITH_SERVICE_KEY
IDENTITY_SERVICE_URL=https://YOUR_IDENTITY_SERVICE.onrender.com
SERVICE_TIMEOUT_MS=8000
```

## AI Service

```env
NODE_ENV=production
INTERNAL_CONTEXT_SECRET=REPLACE_WITH_CONTEXT_SECRET
OPENROUTER_API_KEY=REPLACE_WITH_PROVIDER_KEY
OPENROUTER_MODEL=REPLACE_WITH_MODEL_ID
OPENROUTER_TIMEOUT_MS=10000
```

AI remains advisory and receives no Supabase mutation secret.

## Vercel frontend

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_PUBLISHABLE_KEY
BACKEND_URL=https://api-services.onrender.com
```

Never add `SUPABASE_SECRET_KEY`, a service-role JWT,
`INTERNAL_CONTEXT_SECRET`, or `INTERNAL_SERVICE_KEY` to Vercel.

## Render-provided values

Do not paste a local `PORT`. Render supplies it. Each service already reads
`PORT` and exposes `GET /health`.

## Deployment order

1. Configure and deploy Identity, Reporting, Notification, Clinical,
   Appointment, Inventory, and AI services.
2. Verify each `/health` endpoint.
3. Put the final service URLs on the gateway.
4. Set `ALLOWED_ORIGINS` to the exact Vercel origin.
5. Deploy the gateway.
6. Put only the gateway `BACKEND_URL` on Vercel.
7. Verify unauthorized and wrong-role requests before workflow testing.

## Google Workspace report delivery

Notification Service additions:

```env
GOOGLE_GMAIL_ENABLED=false
GOOGLE_GMAIL_CLIENT_ID=REPLACE_IN_RENDER_ONLY
GOOGLE_GMAIL_CLIENT_SECRET=REPLACE_IN_RENDER_ONLY
GOOGLE_GMAIL_REFRESH_TOKEN=REPLACE_IN_RENDER_ONLY
GOOGLE_GMAIL_SENDER=clinic-reports@YOUR_SCHOOL_DOMAIN
GOOGLE_GMAIL_ALLOWED_DOMAIN=YOUR_SCHOOL_DOMAIN
GOOGLE_GMAIL_ALLOWED_RECIPIENTS=
```

`GOOGLE_GMAIL_ALLOWED_RECIPIENTS` is optional and comma-separated. Keep
`EMAIL_PROVIDER_API_KEY` only until Gmail is deployed and live-verified; the
current worker does not use it.

Reporting Service additions:

```env
NOTIFICATION_SERVICE_URL=https://YOUR_NOTIFICATION_SERVICE.onrender.com
GOOGLE_DRIVE_ENABLED=false
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=REPLACE_IN_RENDER_ONLY
GOOGLE_DRIVE_PRODUCTION_FOLDER_ID=REPLACE_IN_RENDER_ONLY
GOOGLE_SHEETS_SPREADSHEET_ID=REPLACE_IN_RENDER_ONLY
GOOGLE_ALLOWED_WORKSPACE_DOMAIN=YOUR_SCHOOL_DOMAIN
```

The Base64 service-account JSON remains a secret. It belongs only to Reporting
Service and grants access only through explicit Shared Drive membership. Do not
configure domain-wide delegation. Gmail OAuth values belong only to
Notification Service. The API Gateway and frontend receive neither credential.

Deploy with both Google flags set to `false`, then enable Drive, Sheets, and
Gmail in staged order after the migration and operator acceptance tests pass.
