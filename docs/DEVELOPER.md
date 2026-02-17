# Developer: Bootstrap and Test Guide

This document explains how to bootstrap the repository and run the PuddleJumper test suite
locally. It also documents the seeded admin test credentials and the `setup-admin` test helper.

## 1. Bootstrapping the repository

From your home directory, with the repo checked out at `~/projects/puddlejumper`:

```bash
cd ~/projects/puddlejumper
bash scripts/bootstrap.sh
```

`bootstrap.sh` will:
- change into `n8drive` (the monorepo workspace),
- ensure nvm/node 20 is available,
- enable corepack and pnpm 8.15.8,
- clear stale `node_modules` (useful for native addons),
- copy `n8drive/.env.sample` to `n8drive/.env` if missing,
- run `pnpm install` (prefer frozen lockfile),
- run `pnpm -w build` and `pnpm -w test` (best-effort),
- attempt `pnpm exec playwright install`.

If bootstrap succeeds, the script prints `Workspace tests OK.` after test completion.

## 2. Seeded admin credentials

The repository includes default test credentials in `n8drive/.env.sample`:

```env
PJ_ADMIN_EMAIL=admin@local.test
PJ_ADMIN_PASSWORD=changeme
PJ_ADMIN_ROLES=admin,superuser

TEST_ADMIN_EMAIL=admin@local.test
TEST_ADMIN_PASSWORD=changeme
TEST_ADMIN_ROLES=admin

JWT_SECRET=dev-secret
AUTH_ISSUER=puddle-jumper
AUTH_AUDIENCE=puddle-jumper-api
```

These values help the helper register/login a test admin and keep `signJwt`/`verifyJwt`
consistent locally.

## 3. Test helper: `./test/setup-admin.ts`

Helper location:

`n8drive/apps/puddlejumper/test/setup-admin.ts`

Behavior:
- attempts register/create admin via common endpoints,
- attempts seed endpoints,
- attempts login and normalizes token shapes,
- falls back to local `signJwt`,
- exports `getAdminToken()` and sets `global.ADMIN_TOKEN` and `process.env.TEST_ADMIN_TOKEN`.

Usage:

```ts
import './setup-admin';
```

or

```ts
import { getAdminToken } from './setup-admin';
const token = await getAdminToken();
```

The helper is intentionally not loaded globally in Vitest because some stateful suites can
fail when global setup mutates auth/token state.

## 4. Tests that should import the helper

Import the helper in suites that need a live admin token, including:
- `n8drive/apps/puddlejumper/test/admin.test.ts`
- `n8drive/apps/puddlejumper/test/tier-enforcement.test.ts`

## 5. CI environment variables

Recommended CI environment variables:
- `JWT_SECRET`
- `AUTH_ISSUER=puddle-jumper`
- `AUTH_AUDIENCE=puddle-jumper-api`

Optional overrides:
- `PJ_ADMIN_EMAIL`, `PJ_ADMIN_PASSWORD`
- `TEST_ADMIN_TOKEN` or `ADMIN_TOKEN`

## 6. Test logs

When running bootstrap/tests, logs are captured at:
- `.pj-test-logs/bootstrap.log`
- `.pj-test-logs/pj-tests.log`

## 7. Central entrance (web)

`n8drive/web` is the internal PublicLogic Control Center launcher.

Launcher link env vars:
- `NEXT_PUBLIC_PL_URL_MAIN`
- `NEXT_PUBLIC_PL_URL_PJ`
- `NEXT_PUBLIC_PL_URL_PJ_ADMIN`
- `NEXT_PUBLIC_PL_URL_PJ_GUIDE`
- `NEXT_PUBLIC_PL_URL_OS`
- `NEXT_PUBLIC_PL_URL_DEPLOY_CONSOLE` (optional)
- `NEXT_PUBLIC_PL_URL_CHAMBER_CONNECT` (optional)

If a URL is unset, the launcher card is shown as **Not configured** and does not render a broken link.

### Quick Start CSS/CSP note

`/pj/guide` now uses an external stylesheet at
`n8drive/apps/puddlejumper/public/styles/pj-guide.css`.
The CSP in `serverMiddleware.ts` stays strict (`style-src 'self' https://fonts.googleapis.com`)
and intentionally does not allow `unsafe-inline`.

## 8. Known pitfalls

- `better-sqlite3` / `NODE_MODULE_VERSION` mismatch errors usually mean modules were built under a different Node runtime.
- Run `source ~/.nvm/nvm.sh && nvm use 20` before ad-hoc `pnpm` commands.
- If mismatch errors persist, rerun `bash scripts/bootstrap.sh` to rebuild native modules under Node 20.
- Staging SQLite `CANTOPEN` usually means `/app/data` is not writable by the `node` user; verify mount + Fly env DB paths and check entrypoint diagnostics.
- After Fly env/path changes, redeploy and confirm `/health` is stable and logs do not show repeated sqlite open failures.
