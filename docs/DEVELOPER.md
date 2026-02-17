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
