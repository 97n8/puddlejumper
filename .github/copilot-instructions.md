# GitHub Copilot Instructions

This document provides guidance for GitHub Copilot when working with the PuddleJumper repository.

## Repository Overview

PuddleJumper is a multi-tenant governance engine for municipal decision workflows, part of the PublicLogic ecosystem. The repository contains multiple projects in a monorepo structure:

- **n8drive/**: Core PuddleJumper application (pnpm monorepo with TypeScript/Express backend and Next.js frontend)
- **chamber-connect/**: Chamber of Commerce case management prototype
- **live-edit-deploy-console/**: Municipal M365 tenant deployment engine
- **publiclogic-operating-system/**: PublicLogic OS playbooks (canonical source)
- **publiclogic-os-ui/**: PublicLogic OS frontend (vanilla JS static app)
- **publiclogic-site/**: Marketing/public site

## Tech Stack

### Backend (n8drive/)
- **Language**: TypeScript 5.7+
- **Runtime**: Node.js 20.x
- **Framework**: Express 4.x
- **Database**: SQLite with better-sqlite3
- **Package Manager**: pnpm 8.15.8 (use corepack)
- **Monorepo**: pnpm workspaces (defined in `n8drive/pnpm-workspace.yaml`)
- **Testing**: Vitest
- **Build**: TypeScript compiler (tsc)

### Frontend (n8drive/web/)
- **Framework**: Next.js 16.x
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x
- **Package Manager**: npm (NOT pnpm - has its own package-lock.json)
- **Design System**: Geist font, Tailwind zinc/emerald color palette

### Packages Structure
```
n8drive/
  ├── apps/
  │   ├── puddlejumper/     # Main backend app
  │   └── logic-commons/    # OAuth/auth service
  ├── packages/
  │   ├── core/             # Shared utilities
  │   └── vault/            # Policy/audit layer (planned)
  └── web/                  # Next.js frontend
```

## Development Workflow

### Getting Started
```bash
# First-time setup (installs deps, builds, runs tests)
bash scripts/bootstrap.sh

# Backend development
cd n8drive
pnpm install
pnpm run dev              # Start PuddleJumper server (port 3002)

# Frontend development
cd n8drive/web
npm ci                    # Use npm, NOT pnpm
npm run dev              # Start Next.js dev server
```

### Build & Type-Check Commands
```bash
cd n8drive
pnpm run build           # Build all packages
pnpm run build:pj        # Build PuddleJumper only
pnpm run build:web       # Build Next.js frontend
pnpm run typecheck       # TypeScript check across all packages (tsc --build --noEmit)
pnpm run ci              # Full CI pipeline: typecheck + contract check + test
```

### Testing Commands
```bash
cd n8drive
pnpm run test            # Run all tests
pnpm run test:core       # Test core package
pnpm run test:pj         # Test PuddleJumper

# Run a single test file
pnpm --filter @publiclogic/puddlejumper run test -- test/admin.test.ts

# Known pre-existing failures (do not fix unless directly related to your change):
#   vaultContract.test.ts, config-validation.test.ts, oauthStateStore.test.ts
```

### Test Helper: setup-admin.ts
Tests that need a live admin token must import the helper at `n8drive/apps/puddlejumper/test/setup-admin.ts`. It registers/logins an admin, normalizes token shapes, and falls back to local `signJwt`. Do **not** load it globally in Vitest — import per-suite only.

```ts
import { getAdminToken } from './setup-admin';
const token = await getAdminToken();
```

Test logs are written to `.pj-test-logs/` (bootstrap.log, pj-tests.log).

## Coding Standards

### TypeScript
- **Strict Mode**: Use strict TypeScript settings
- **No `any`**: Avoid using `any` type; use proper typing
- **Type Imports**: Use `type` keyword for type-only imports
- **Module System**: Use ES modules (`type: "module"` in package.json)

### Authentication & Security
- **JWT**: Minimum 32-character JWT_SECRET (enforced by Zod validation)
- **Cookies**: HttpOnly, SameSite=Lax for session cookies
- **CSRF Protection**: All mutating API requests require `X-PuddleJumper-Request: true` header
- **CSP**: Strict Content Security Policy - NO inline scripts or styles
  - `script-src 'self'`
  - `style-src 'self' https://fonts.googleapis.com`
  - All HTML pages must use external CSS/JS files
  - Use CSS classes instead of inline style attributes
- **Authorization**: Check user roles (`admin` vs regular user) for protected routes
- **Token Extraction**: Cookie first, then `Authorization: Bearer` header

### Database (SQLite)
- **Durability Pragmas**: All SQLite stores must use:
  ```sql
  journal_mode = WAL
  synchronous = NORMAL
  wal_autocheckpoint = 1000
  ```
- **Store Pattern**: Use better-sqlite3 for synchronous operations
- **Transactions**: Use transactions for multi-statement operations

### API Design
- **Response Format**: Wrap JSON responses as:
  ```typescript
  {
    success: boolean,
    correlationId: string,
    data: ...
  }
  ```
- **CSRF**: Mutating methods (POST, PUT, PATCH, DELETE) require CSRF header
- **Safe Methods**: GET, HEAD, OPTIONS are exempt from CSRF
- **Error Handling**: Return appropriate HTTP status codes (401, 403, 500)

### CSS/Styling
- **Design System**: Use consistent CSS variables across all backend HTML:
  ```css
  --bg: #09090b
  --surface: #18181b
  --border: #27272a
  --accent: #10b981 (emerald)
  --radius: 12px
  ```
- **Frontend**: Use Tailwind CSS with zinc/emerald palette
- **No Inline Styles**: Due to CSP, use external CSS files only

### Naming Conventions
- **Files**: kebab-case for file names (e.g., `approval-store.ts`)
- **Functions**: camelCase
- **Classes**: PascalCase
- **Constants**: UPPER_SNAKE_CASE for environment variables

## File Organization

### Backend Routes
- Routes are in `n8drive/apps/puddlejumper/src/api/routes/`
- Server configuration in `n8drive/apps/puddlejumper/src/api/server.ts`
- Middleware in `n8drive/apps/puddlejumper/src/api/serverMiddleware.ts`

### Frontend Pages
- Pages in `n8drive/web/src/app/` following Next.js App Router structure
- Protected pages use `RequireAuth` wrapper
- API calls use `pjFetch` wrapper (automatically adds CSRF header)

### Public Assets
- Backend HTML/CSS/JS in `n8drive/apps/puddlejumper/public/`
- Styles: `public/styles/pj.css`, `pj-admin.css`, `pj-guide.css`, `pj-signin.css`
- Scripts: `public/scripts/`


## Security Requirements

### Authentication
- Built-in `/api/login` requires `ALLOW_ADMIN_LOGIN=true` and `NODE_ENV !== production`
- OAuth supported: Google, GitHub, Microsoft
- JWT tokens must validate: exp, iss, aud
- Support both RS256 (JWT_PUBLIC_KEY) and HS256 (JWT_SECRET)

### CSRF Protection
- Implemented in `@publiclogic/core` (`csrfProtection()`)
- Required on all mutating API methods
- Missing marker returns 403

### Authorization
- Check user roles for protected routes
- Admin-only routes must verify `role === "admin"`
- Return 401 for unauthenticated, 403 for unauthorized

### Sensitive Data
- Never commit secrets to source code
- Use environment variables for credentials
- Cookie domain is optional (COOKIE_DOMAIN env var)

## Important Conventions

### Package Manager Usage
- **Backend (n8drive/)**: Use pnpm (via corepack enable)
- **Frontend (n8drive/web/)**: Use npm (has separate package-lock.json)
- Never mix package managers in the same directory

### Monorepo Structure
- Workspace authority: `n8drive/pnpm-workspace.yaml`
- Workspace dependencies: Use `workspace:*` protocol
- Ignored built dependencies: better-sqlite3, esbuild

### Playbook Synchronization
- Three directories must stay in sync:
  - `publiclogic-operating-system/` (canonical source)
  - `publiclogic-os-ui/content/playbooks/`
  - `publiclogic-site/HMLP/content/playbooks/`
- Use `./scripts/sync-playbooks.sh` to sync
- CI checks for drift with `--check` flag

### Health Checks
- `/health`: Deep check (DB, volume, secrets)
- `/ready`: Lightweight check (DB ping only)
- Fly.io uses `/health` endpoint
- Keep `min_machines_running=1` to prevent cold starts

## Deployment

### Supported Platforms
- **Fly.io**: Containerized deployment (preferred for production)
- **Vercel**: Serverless deployment
- **Docker**: Standard container deployment

### Environment Variables
- Required: `JWT_SECRET` (min 32 chars), `AUTH_ISSUER`, `AUTH_AUDIENCE`
- Database: `PRR_DB_PATH`, `CONNECTOR_DB_PATH`, `IDEMPOTENCY_DB_PATH` (default: `./data/idempotency.db`)
- URLs: `PJ_PUBLIC_URL`, `BASE_URL`
- OAuth: provider-specific client IDs and secrets
- `PJ_RUNTIME_CONTEXT_JSON`, `PJ_RUNTIME_TILES_JSON`, `PJ_RUNTIME_CAPABILITIES_JSON` — required in production; endpoints return 503 when unset
- `PJ_ALLOWED_PARENT_ORIGINS` — trusted origins for iframe postMessage identity context
- `ALLOW_ADMIN_LOGIN=true` — opts in to built-in `/api/login` (non-production only)
- `ALLOW_PROD_ADMIN_LOGIN=true` — required additionally to enable built-in login in production

## Documentation

### Key Documents
- `n8drive/README.md`: Main PuddleJumper documentation
- `docs/DEVELOPER.md`: Bootstrap guide, test helper, and known pitfalls
- `n8drive/ENV_REFERENCE.md`: Full environment variable reference
- `n8drive/docs/`: Architecture and user guides
- `n8drive/ops/ARCHITECTURE-NORTH-STAR.md`: Strategic roadmap
- `n8drive/SECURITY.md`: Security model and policies
- `n8drive/ops/DISASTER-RECOVERY.md`: DR procedures (RTO ≤30min, RPO ≤6h)

## Special Notes

### Architecture Pattern
PuddleJumper is a control plane for municipal governance:
- **Fail-closed governance**: Actions denied by default
- **Dispatch isolation**: Separates decision, execution, authority
- **Operational visibility**: Full audit trail of all actions

### Frontend Integration
- Frontend consumes ~25 of 30+ backend APIs
- Some endpoints not yet integrated (invitations, plan updates, chain template creation)
- Check `n8drive/docs/FRONTEND_INTEGRATION_PLAN.md` for status

### Operational Readiness
- 3-tier readiness model: Alpha → Pilot → Production
- See `n8drive/ops/MUNICIPAL-READINESS.md` for criteria
- Monitoring via Prometheus/Grafana

## Known Pitfalls

- **`better-sqlite3` native module mismatch**: If you see `NODE_MODULE_VERSION` errors, modules were built under a different Node version. Run `source ~/.nvm/nvm.sh && nvm use 20` then `bash scripts/bootstrap.sh` to rebuild.
- **Staging `CANTOPEN`**: Means `/app/data` is not writable by the `node` user on Fly.io. Verify volume mount and DB path env vars, then check `/health` after redeploy.
- **`pnpm` in `n8drive/web/`**: This directory uses npm (has its own `package-lock.json`). Running pnpm there will break the lockfile.

## Resources

- Main Repo: https://github.com/97n8/puddlejumper
- PublicLogic: https://publiclogic.org
- Env variable reference: `n8drive/ENV_REFERENCE.md`
- Operations: `n8drive/ops/`
