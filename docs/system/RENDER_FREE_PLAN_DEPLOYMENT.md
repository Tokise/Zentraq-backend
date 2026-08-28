# Render Free-Plan Deployment Without a Blueprint

## Purpose

This guide describes how to deploy the Zentraq backend manually from the
Render Dashboard without a `render.yaml` Blueprint. It is intended for a
capstone or demonstration environment, not a production clinical deployment.

## Recommended Approach

Create one Render **Web Service** for every backend component that accepts HTTP
requests. Connect every service to the same Git repository, then configure its
own root directory, build command, start command, environment variables, and
health-check path in the Render Dashboard.

Do not create a Render Background Worker or Private Service when using only
free instances. Those service types do not offer a free instance. A process
that does not expose an HTTP server must remain on its existing supported job
platform, be triggered by an authenticated HTTP endpoint, or move to a paid
Render service.

## Important Free-Tier Constraints

- Render currently shares 750 free instance hours per workspace each month.
  Multiple running services consume this shared allowance.
- A free web service spins down after 15 minutes without inbound traffic. Its
  next request can take about one minute while the service starts again.
- Free web services cannot receive private-network traffic. Calls between free
  services therefore use their public HTTPS `onrender.com` URLs.
- The filesystem is ephemeral. Do not store uploads, generated reports,
  database files, or other durable data on the service filesystem.
- Free services have 512 MB RAM and limited CPU. Keep build and runtime memory
  usage small.
- Render's free Postgres database expires after 30 days and has no backups. The
  project should continue using its approved Supabase project for durable data
  unless the architecture is intentionally changed and reviewed.

These limitations make the free plan appropriate for demonstrations and
testing, but not safe to describe as production-ready or highly available.

## Application Requirements

Every HTTP service must:

1. Bind to `0.0.0.0`, not only `localhost` or `127.0.0.1`.
2. Read its listening port from the `PORT` environment variable. Render uses
   port `10000` by default, but application code should not hardcode it.
3. Provide a lightweight unauthenticated liveness endpoint such as `/health`
   that returns a `2xx` response without disclosing configuration, dependency
   details, user data, or protected health information.
4. Log to standard output and standard error rather than local log files.
5. Shut down gracefully when Render sends a termination signal.

The health endpoint should prove that the HTTP process is responsive. Avoid a
deep database query in this endpoint because a temporary Supabase problem would
cause Render to restart an otherwise healthy process repeatedly.

## Manual Dashboard Procedure

Repeat these steps for each HTTP service:

1. Push the deployment-ready branch to the connected Git provider.
2. In the Render Dashboard, choose **New > Web Service**.
3. Select the Zentraq backend repository.
4. Enter a unique service name.
5. Select the same Render region for all services. Prefer the region closest to
   the Supabase project and expected users.
6. Select the intended deployment branch.
7. Set the service's **Root Directory** to its directory in the repository.
   Commands and Docker paths become relative to this directory.
8. Select the runtime used by that service:
   - For a service with a production Dockerfile, select **Docker** and confirm
     the Dockerfile path and build context.
   - For a native Node.js or Python service, enter the repository's exact build
     and start commands. Do not invent a second dependency workflow.
9. Select the **Free** instance type.
10. Add the environment variables listed in the service's committed example
    environment file. Enter real secret values only in Render, never in Git.
11. Set **Health Check Path** to `/health` or the service's actual liveness
    endpoint.
12. Create the service and wait for its first deploy to pass.
13. Open `https://<service-name>.onrender.com/health` and verify the expected
    response.

Create the downstream services first and the public API or gateway last. This
lets the gateway receive final downstream URLs before its first useful test.

## Environment Variables

Use a Render Environment Group for values that are genuinely shared by all
services. Keep service-specific credentials and authorization scopes on the
individual service.

Typical server-side values include:

```text
NODE_ENV=production
SUPABASE_URL=<project URL>
SUPABASE_ANON_KEY=<only if the server intentionally uses the anon role>
SUPABASE_SERVICE_ROLE_KEY=<server-side services only, when strictly required>
ALLOWED_ORIGINS=https://<frontend domain>
SERVICE_AUTH_SECRET=<long random value stored only in Render>
```

Do not copy `PORT` from local development unless a framework requires it to be
declared explicitly. Render supplies `PORT` to web services.

Security requirements:

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to a browser, public build variable,
  response body, health endpoint, or log.
- Restrict CORS to the deployed frontend origin. CORS is not authorization.
- Validate end-user JWTs on the server and enforce role and ownership rules for
  every request.
- Use different secrets for user sessions and service-to-service calls.
- Rotate any credential that has previously been committed or printed in logs.
- Prefer separate, least-privileged credentials per service where the current
  Supabase design permits it.

## Service-to-Service URLs

After each downstream service receives its public URL, add explicit base URL
variables to callers, for example:

```text
RECORDS_SERVICE_URL=https://zentraq-records.onrender.com
NOTIFICATIONS_SERVICE_URL=https://zentraq-notifications.onrender.com
```

Because free web services cannot receive private-network traffic, these URLs
are public. Every internal endpoint must still require authentication. Use an
`Authorization` header or signed request scheme, compare credentials in
constant time, reject replay where requests cause sensitive state changes, and
never place secrets in query strings.

Do not rely on an obscure `onrender.com` hostname as access control. Apply rate
limits, small request-body limits, strict schema validation, timeouts, and safe
retry rules. Retry only idempotent operations unless an idempotency key protects
the write.

## Database Migrations

Do not run shared database migrations independently from every service start
command. Concurrent starts and automatic restarts can race or repeat migration
work.

For the free-plan deployment, run reviewed Supabase migrations once from a
trusted administrator workstation or a protected CI workflow before deploying
application code that depends on them. Confirm the target Supabase project
before applying a migration and keep a recovery plan for destructive changes.

## Verification Checklist

- Each service deploy reports a successful health check.
- Every service binds to `0.0.0.0:$PORT`.
- Public routes reject missing, expired, malformed, and wrong-role tokens.
- Internal routes reject missing or invalid service credentials.
- CORS allows only approved frontend origins.
- Logs contain no access tokens, secrets, passwords, or patient information.
- A cold-start test is performed after at least 15 minutes of inactivity.
- Downstream timeouts produce a controlled error rather than an indefinite wait.
- Database migrations are confirmed separately from application deployment.
- The frontend is configured with only the intended public API URL, not a
  Supabase service-role key or internal service credential.

## References

- [Render: Deploy for Free](https://render.com/docs/free)
- [Render: Web Services and Port Binding](https://render.com/docs/web-services)
- [Render: Monorepo Support](https://render.com/docs/monorepo-support)
- [Render: Health Checks](https://render.com/docs/health-checks)
- [Render: Environment Variables and Secrets](https://render.com/docs/configure-environment-variables)
- [Render: Multi-Service Architectures](https://render.com/docs/multi-service-architecture)

