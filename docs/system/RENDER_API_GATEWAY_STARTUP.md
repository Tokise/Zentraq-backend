# Render API Gateway Startup Notes

## Internal Context Secret

The API gateway validates `INTERNAL_CONTEXT_SECRET` during process startup. The
value must contain at least 32 characters. A missing, blank, or shorter value
causes startup to stop with:

```text
Error: INTERNAL_CONTEXT_SECRET must contain at least 32 characters.
```

Generate at least 32 random bytes and encode them as hexadecimal, producing a
64-character value:

```powershell
$secretBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
[Convert]::ToHexString($secretBytes).ToLowerInvariant()
```

Add the generated output in Render under:

```text
INTERNAL_CONTEXT_SECRET=<generated 64-character value>
```

The secret is server-only. Never commit it, paste it into public messages, add
it to frontend variables, reuse a Supabase credential, or print it in logs.

Use the same value on the gateway and every downstream service that verifies
the gateway's signed internal context, unless the implementation explicitly
supports separate per-service signing credentials. Rotate the value across all
participants together to avoid authentication failures.

Changing only an environment variable does not require a source rebuild. In
Render, choose **Save and deploy** after adding the value.

## Build Versus Startup Diagnosis

The following log line confirms that the monorepo TypeScript build completed
and Render reached runtime startup:

```text
node dist/index.js
```

An `INTERNAL_CONTEXT_SECRET` exception after that line is a runtime
configuration failure, not the earlier `@zentraq/shared` build-resolution
failure.

