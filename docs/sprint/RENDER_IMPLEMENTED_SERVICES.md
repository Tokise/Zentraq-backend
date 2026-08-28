# Render Implemented Service Inventory

## Source Inventory

The backend repository contains these runnable service directories:

1. `api-gateway`
2. `identity-service`
3. `clinical-service`
4. `appointment-service`
5. `inventory-service`
6. `notification-service`
7. `reporting-service`
8. `ai-service`

There is no `records-service` directory. Do not create a Render service or
deployment claim for a records service based only on an earlier placeholder
environment variable.

## Recommended Manual Deployment Order

After the API gateway is healthy, use this order:

1. `identity-service`
2. `clinical-service`
3. `appointment-service`
4. `inventory-service`
5. `notification-service`
6. `reporting-service`
7. `ai-service`

Identity is foundational for authentication and authorization flows. The
transactional clinic services follow. Notification and reporting services are
later because they consume or summarize operational data. The AI service is
last because it is optional to core clinical correctness and can be sensitive
to the free plan's CPU, memory, cold-start, and outbound-traffic limits.

If the clinical service is already being deployed, finish it, then deploy
identity before performing authenticated end-to-end clinical tests.

## Render Command Pattern

Keep the Render **Root Directory** empty so pnpm can access the complete
workspace. Replace `<service>` with one implemented directory name:

```text
Build Command: pnpm install --frozen-lockfile && pnpm --filter "{services/<service>}..." build
Start Command: pnpm --filter "{services/<service>}" start
```

Every service should use its own committed configuration contract. Share the
same `INTERNAL_CONTEXT_SECRET` only with services that participate in the
gateway's signed internal-context protocol. Do not infer environment-variable
names from directory names; inspect the API gateway configuration and each
service's example environment file.

After deploying a downstream service, copy its base HTTPS Render URL into the
exact gateway variable used by source, save the environment change, and deploy
the gateway. The frontend must continue to call only the API gateway.

