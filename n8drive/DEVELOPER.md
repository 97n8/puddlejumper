# Developer Guide

## Central Entrance (web)

The web home at `n8drive/web` is the internal PublicLogic Control Center.
It reads these env vars to populate the launcher:

- `NEXT_PUBLIC_PL_URL_MAIN`
- `NEXT_PUBLIC_PL_URL_PJ`
- `NEXT_PUBLIC_PL_URL_PJ_ADMIN`
- `NEXT_PUBLIC_PL_URL_PJ_GUIDE`
- `NEXT_PUBLIC_PL_URL_OS`
- `NEXT_PUBLIC_PL_URL_DEPLOY_CONSOLE` (optional)
- `NEXT_PUBLIC_PL_URL_CHAMBER_CONNECT` (optional)

If an env var is not set, the app card will display as **Not configured** instead of rendering a broken link.

### Quick Start CSS / CSP note

The PJ Quick Start previously used inline `<style>`. To stay CSP-strict, the Quick Start CSS was moved to `n8drive/apps/puddlejumper/public/styles/pj-guide.css` and included via `<link rel="stylesheet" href="/styles/pj-guide.css">`. The CSP header in PJ's `serverMiddleware.ts` intentionally *does not* include `'unsafe-inline'`.

## Build & Test

```bash
# From n8drive/
pnpm install

# Build order
pnpm --filter @publiclogic/core build
pnpm --filter @publiclogic/logic-commons build
pnpm --filter @publiclogic/puddlejumper build

# Tests
pnpm run test          # all tests
pnpm run test:pj       # PJ tests only
pnpm run typecheck     # TypeScript check

# Web app
cd web
pnpm lint
pnpm build
```
