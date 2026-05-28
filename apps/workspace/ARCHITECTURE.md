# LogicOS Architecture

## Overview

LogicOS is the React + Vite SPA frontend for the PublicLogic platform. It is a **pure
frontend application** — there is no application server in this repo. All external API
access (GitHub, Microsoft 365, Google Workspace) is brokered by **PuddleJumper**, a
separate backend service hosted at `https://api.publiclogic.org`.

```
┌──────────────────┐      session cookie       ┌─────────────────────┐
│ Browser (LogicOS)│  ─────────────────────▶  │  PuddleJumper (PJ)  │
│   React + Vite   │  ◀─────────────────────  │  Fly.io / Node      │
└──────────────────┘   JSON over HTTPS         └──────────┬──────────┘
                                                          │ injects stored
                                                          │ connector tokens
                                                          ▼
                                          GitHub · Microsoft Graph · Google APIs
```

Tokens are never stored in the browser. The PuddleJumper session cookie is the only
credential the SPA holds.

## Live URLs

| Surface  | URL                                          |
|----------|----------------------------------------------|
| Frontend | https://logicos-rho.vercel.app (alias: os.publiclogic.org) |
| Backend  | https://api.publiclogic.org                  |

## Repository Layout

```
src/
├── App.tsx                 # Root — auth gate, tool routing, global state
├── main.tsx                # Entry — wraps <AuthProvider>
├── components/             # Shared UI (LoginPage, Toolbar, panels, ui/)
├── features/               # Feature modules (~40 panels, lazy-loaded)
├── services/
│   ├── auth/AuthContext.tsx   # PJ session — useAuth() hook
│   ├── pjApi.ts               # Single API client for all provider calls
│   ├── microsoftPJService.ts  # Microsoft Graph wrapper over pjApi
│   └── googlePJService.ts     # Google APIs wrapper over pjApi
├── hooks/                  # useKV, useMobileMode, useConnectorStatus, ...
├── lib/                    # Types, utils, logger, environment access
└── test/                   # Vitest specs

api/                        # Vercel serverless routes (Puddles AI chat,
                            # health checks, fiscal/civic helpers).
public/                     # Static assets shipped with the build.
```

## Auth Flow

1. User clicks a provider on the LoginPage.
2. `AuthContext.login(provider)` redirects to `${PJ}/api/auth/${provider}/login`.
3. PuddleJumper performs the full OAuth dance and sets its session cookie.
4. PJ redirects back to LogicOS with `?auth=success`.
5. `AuthContext` calls `${PJ}/api/me` to hydrate `user`.
6. `App.tsx` swaps from `LoadingSpinner` → `LoginPage` → app shell.

The browser never sees an OAuth provider directly.

## API Client (`src/services/pjApi.ts`)

`pjApi` is the single chokepoint for all backend traffic.

| Namespace            | Upstream (proxied by PJ)                      |
|----------------------|-----------------------------------------------|
| `pjApi.github.*`     | `api.github.com`                              |
| `pjApi.microsoft.*`  | `graph.microsoft.com/v1.0/*`                  |
| `pjApi.google.*`     | `www.googleapis.com/*`                        |
| `pjApi.connectors.*` | PJ connector management (connect / disconnect) |

All requests use `credentials: 'include'`. PJ looks up the user's stored connector
token server-side and injects it into the upstream request.

## State

Client state is held in `useKV` (backed by `@github/spark/hooks` → `localStorage`).
Major keys:

- `logicworkspace-files`
- `logicworkspace-connections` *(legacy — connectors now live server-side in PJ)*
- `logicworkspace-automations`, `logicworkspace-templates`, …

## Build & Deploy

- Vite 7 + React 19 + TypeScript 5.9
- ESLint 9 (flat config) and Vitest for tests
- Deployed to Vercel automatically on push (`vercel.json` configures SPA rewrite,
  cache headers, and CSP)

## Hard Constraints

1. **No direct provider API calls from the browser.** Always go through `pjApi`.
2. **No tokens in `localStorage` / `sessionStorage`.** PJ session cookie only.
3. **No new legacy service files** (`microsoft365.ts`, `google.ts`, `api/` browser
   services were intentionally removed; do not recreate them).
4. **CORS:** PJ's `CORS_ALLOWED_ORIGINS` must include any new Vercel preview origin.
5. **OAuth callbacks:** changing the LogicOS URL requires updating the
   `LOGIC_COMMONS_URL` Fly secret on PuddleJumper.

For day-to-day contributor guidance, see `.github/copilot-instructions.md`.
