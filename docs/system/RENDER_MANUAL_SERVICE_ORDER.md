# Render Manual Service Deployment Order

## Recommended Order

After the API gateway starts successfully, deploy the HTTP domain services in
this order:

1. Clinical service
2. Records service
3. Appointments service
4. Inventory service
5. Notifications service
6. Reports service

Deploying one domain service first provides a complete gateway-to-service test
before repeating the configuration across all remaining services. Reports and
notifications are later because they commonly depend on data or events produced
by the transactional services.

## Clinical Service

Create another Render **Web Service** connected to the same repository and
branch as the API gateway.

Keep **Root Directory** empty so pnpm can access the root lockfile and shared
workspace packages. If the repository directory is
`services/clinical-service`, use:

```text
Build Command: pnpm install --frozen-lockfile && pnpm --filter "{services/clinical-service}..." build
Start Command: pnpm --filter "{services/clinical-service}" start
```

Confirm the directory name in the repository before copying these commands.

Configure `/health` as the Render health-check path. Add only the variables
declared by the service's example environment file. The service will normally
need its Supabase project configuration and must receive the exact same
`INTERNAL_CONTEXT_SECRET` used by the gateway so it can verify signed internal
request context. An elevated Supabase key should be added only when the service
implementation requires privileged access.

After the clinical service deploys:

1. Verify its public `/health` endpoint returns a successful response.
2. Copy its Render HTTPS URL.
3. Replace the gateway's temporary `CLINICAL_SERVICE_URL` value with that URL.
4. Save and deploy the gateway environment update.
5. Test one clinical request through the gateway with a valid user token.
6. Confirm a direct clinical-service request without valid internal context is
   rejected.

The frontend must continue calling only the API gateway. It should not call a
domain service directly.

