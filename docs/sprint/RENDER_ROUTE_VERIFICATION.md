# Render Route Verification

## Root-Path `NOT_FOUND` Response

The following response from a deployed service does not by itself indicate a
failed Render deployment:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No route matches GET /."
  }
}
```

It means Render reached the running application and the application's router
does not define `GET /`. API-only services do not need a root-page route.

## Health Verification

Verify each service using its implemented liveness endpoint, normally:

```text
https://<service>.onrender.com/health
```

Configure the same path in **Render > Service > Settings > Health Check Path**.
A successful health response proves the process is reachable and responsive;
it does not prove every database dependency, authorization path, or domain
workflow works end to end.

If `/health` also returns `NOT_FOUND`, inspect the service source for its actual
health route before changing Render settings. Do not use `/` as the health path
merely to suppress a harmless API root response.

## Functional Verification

After health checks pass:

1. Test public authentication routes through the API gateway.
2. Test protected gateway routes with a valid Supabase user access token.
3. Confirm missing, malformed, expired, and wrong-role tokens are rejected.
4. Confirm downstream service URLs are configured on the gateway.
5. Confirm a direct request to a protected domain-service route without valid
   internal context is rejected.
6. Inspect Render logs for controlled downstream errors without logging tokens,
   secrets, passwords, or patient data.

The frontend should call the API gateway's documented route prefixes, not the
gateway root path and not a domain service directly.

