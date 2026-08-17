# Render Environment Variables

Use Render's **Environment > Add from .env** control and enter one
`KEY=value` pair per line. Real credentials must be entered only in Render and
must never be committed to the repository or pasted into public messages.

## API Gateway Template

```text
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN
SERVICE_AUTH_SECRET=GENERATE_A_RANDOM_64_CHARACTER_SECRET
DOMAIN_SERVICE_URL=https://YOUR_DOMAIN_SERVICE.onrender.com
```

Add one URL variable for every downstream service called by the gateway. Use
the exact variable names expected by the application source.

The API gateway should not receive the Supabase service-role key unless its
implemented responsibilities strictly require privileged database access.

## Internal HTTP Service Template

```text
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
SERVICE_AUTH_SECRET=THE_SAME_VALUE_CONFIGURED_ON_THE_GATEWAY
```

Only provide `SUPABASE_SERVICE_ROLE_KEY` to a service that performs an operation
requiring it. The key bypasses Row Level Security and must never appear in
browser code, frontend environment variables, URLs, health responses, or logs.

Internal services should not enable browser CORS. Calls from the gateway are
server-to-server calls and do not require CORS.

## Values Render Supplies

Do not paste a local development port. Render supplies `PORT` to every Web
Service. Application servers must bind to `0.0.0.0` and read this variable.

Do not paste local-only values such as:

```text
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000
DOMAIN_SERVICE_URL=http://localhost:8001
```

## Secret Generation

Generate a separate high-entropy service secret locally. One PowerShell option
is:

```powershell
$secretBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
[Convert]::ToHexString($secretBytes).ToLowerInvariant()
```

Copy only the generated value into Render. Use the same service-authentication
secret on a caller and its downstream service unless the application supports
more secure per-service credentials. Do not reuse user session, Supabase, or
database credentials as the service secret.

## Deployment Order

1. Deploy downstream HTTP services and record their HTTPS Render URLs.
2. Configure each downstream service's Supabase values and service credential.
3. Add the downstream URLs to the API gateway.
4. Set `ALLOWED_ORIGINS` on the gateway to the exact deployed frontend origin.
5. Deploy the gateway and verify rejected unauthenticated requests before
   connecting the frontend.

