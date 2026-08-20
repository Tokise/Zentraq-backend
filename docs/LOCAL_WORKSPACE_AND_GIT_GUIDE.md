# Local Workspace and Git Guide

## Purpose

Zentraq uses one local workspace containing two independent Git repositories.
The parent folder is organizational only and must not contain a `.git`
directory.

```text
D:\Documents\Coding\zentraq\
├── frontend\   GitHub: Tokise/Zentraq
│   ├── app\
│   ├── actions\
│   ├── components\
│   ├── services\
│   └── docs\
└── backend\    GitHub: Tokise/Zentraq-backend
    ├── services\
    ├── packages\
    ├── supabase\
    └── docs\
```

The frontend `services\` directory contains UI-owned helper modules. It is
not the Render microservice directory.

## Verify the workspace

Run these commands after moving machines, restoring a backup, or changing Git
configuration:

```powershell
Set-Location D:\Documents\Coding\zentraq

Test-Path .\.git

git -C .\frontend rev-parse --show-toplevel
git -C .\frontend branch --show-current
git -C .\frontend remote -v
git -C .\frontend status --short

git -C .\backend rev-parse --show-toplevel
git -C .\backend branch --show-current
git -C .\backend remote -v
git -C .\backend status --short
```

Expected results:

- `Test-Path .\.git` is `False`.
- Frontend root is `D:/Documents/Coding/zentraq/frontend`.
- Frontend branch is `rei/development` and origin is
  `https://github.com/Tokise/Zentraq.git`.
- Backend root is `D:/Documents/Coding/zentraq/backend`.
- Backend branch is `rei/dev` and origin is
  `https://github.com/Tokise/Zentraq-backend.git`.

## Install and run

Use separate terminals only for the running processes, not separate editor
windows.

Frontend:

```powershell
Set-Location D:\Documents\Coding\zentraq\frontend
pnpm install --frozen-lockfile
pnpm run dev
```

Backend:

```powershell
Set-Location D:\Documents\Coding\zentraq\backend
pnpm install --frozen-lockfile
pnpm run dev
```

The frontend `.env.local` is restricted to:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
BACKEND_URL=http://localhost:4000
```

Do not restore a database URL, Supabase secret/service-role key, Vercel OIDC
token, provider credential, or internal signing key to the frontend.

## Push frontend-only changes

A push includes commits from the selected repository. It does not infer a
folder from the workspace root.

```powershell
Set-Location D:\Documents\Coding\zentraq

git -C .\frontend status --short
git -C .\frontend diff

git -C .\frontend add -- `
  app\changed-file.tsx `
  actions\changed-action.ts `
  docs\changed-document.md

git -C .\frontend diff --cached --name-only
git -C .\frontend diff --cached --check

git -C .\frontend commit -m "Update frontend gateway integration"
git -C .\frontend push origin rei/development
```

Replace every example path with a path intentionally changed in the current
work. Do not use `git add .` from the workspace root.

## Push backend-only changes

```powershell
Set-Location D:\Documents\Coding\zentraq

git -C .\backend status --short
git -C .\backend diff

git -C .\backend add -- `
  services\api-gateway `
  services\notification-service `
  services\reporting-service `
  supabase\functions\clinical-service `
  supabase\functions\rfid-check-in `
  supabase\migrations `
  docs `
  render.yaml `
  .gitignore

git -C .\backend diff --cached --name-only
git -C .\backend diff --cached --check

git -C .\backend commit -m "Rebalance Render and Supabase service boundaries"
git -C .\backend push origin rei/dev
```

Review all newly visible files under `supabase\` before staging. Confirm that
`supabase\.temp\`, function `node_modules`, environment files, generated
artifacts, and credentials are absent.

## When both repositories change

Create and review two commits. Push the frontend commit to
`Tokise/Zentraq:rei/development` and the backend commit to
`Tokise/Zentraq-backend:rei/dev`. Never add either repository's `.git`,
`node_modules`, build output, or local environment to the other repository.
The local parent folder does not alter the Vercel or Render repository roots.

## Required checks

Frontend:

```powershell
pnpm exec tsc --noEmit
pnpm exec eslint app\rfid-kiosk\scanner\page.tsx lib\api\client.ts
pnpm run build
```

Backend:

```powershell
pnpm run typecheck
pnpm run test
pnpm run lint
pnpm run build
supabase functions serve --env-file .env
```

Source checks do not prove Render, Vercel, Supabase migrations, RLS, Vault,
Cron, Storage, Realtime, or browser role behavior. Verify those systems before
removing rollback services or legacy Server Actions.
## Empty legacy directory after Windows move

A process whose working directory was the old backend path can keep the empty
`D:\Documents\Coding\zentraq-backend` directory locked. After closing that
terminal or Codex task, verify it is empty and remove only that exact path:

```powershell
Get-ChildItem -LiteralPath D:\Documents\Coding\zentraq-backend -Force
Remove-Item -LiteralPath D:\Documents\Coding\zentraq-backend
```

Do not use a recursive wildcard. The active repository is already
`D:\Documents\Coding\zentraq\backend`.
