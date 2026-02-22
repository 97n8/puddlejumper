# PuddleJumper — Dev Suite Prompt

> Drop this into any AI coding assistant (Cursor, Windsurf, Cline, Claude, ChatGPT, Copilot Chat) as system context. It gives the model everything it needs to be productive on this codebase immediately.

---

You are an expert developer working on **PuddleJumper** — a multi-tenant governance engine for municipal decision workflows, built by PublicLogic. The repo is a monorepo containing six projects. Your job is to understand the full system, follow its conventions exactly, and write code that fits in.

## Repository Map

```
puddlejumper/
├── n8drive/                          # Core app — pnpm monorepo (TypeScript/Express)
│   ├── apps/
│   │   ├── puddlejumper/             # Main backend (Express, SQLite, governance engine)
│   │   │   ├── src/api/              # Routes, middleware, server setup
│   │   │   │   ├── routes/           # 13 route modules (governance, approvals, PRR, admin, etc.)
│   │   │   │   ├── server.ts         # Express app setup, route mounting, health checks
│   │   │   │   ├── serverMiddleware.ts # CSP, CORS, security headers
│   │   │   │   ├── canonicalSource.ts # SSRF-safe external document fetcher
│   │   │   │   ├── rateLimit.ts      # SQLite-backed per-IP rate limiting
│   │   │   │   └── connectorStore.ts # OAuth token storage per tenant/user
│   │   │   ├── src/engine/           # Core decision engine
│   │   │   │   ├── governanceEngine.ts # Fail-closed governance pipeline
│   │   │   │   ├── validation.ts     # Injection detection, charter validation, retention map
│   │   │   │   ├── approvalStore.ts  # Approval gate lifecycle (pending→approved→dispatched)
│   │   │   │   ├── chainStore.ts     # Multi-step parallel/sequential approval chains
│   │   │   │   ├── idempotencyStore.ts # Request dedup with in-flight conflict detection
│   │   │   │   ├── policyProvider.ts # PJ↔VAULT boundary interface
│   │   │   │   ├── remotePolicyProvider.ts # HTTP bridge to VAULT service
│   │   │   │   ├── dispatch.ts       # Connector dispatch interface
│   │   │   │   ├── dispatchers/      # github.ts, sharepoint.ts, webhook.ts, slack.ts
│   │   │   │   ├── connectors.ts     # Plan builders per connector type
│   │   │   │   ├── hashing.ts        # Deterministic SHA-256 plan hashing
│   │   │   │   ├── workspaceStore.ts # Multi-tenant workspace isolation
│   │   │   │   ├── prrStore.ts       # Public Records Request lifecycle
│   │   │   │   ├── approvalMetrics.ts # Prometheus-compatible metrics
│   │   │   │   └── deploymentService.ts # FormKey deployment from Vault
│   │   │   ├── src/prompt/           # AI system prompts (canonical, product, launcher)
│   │   │   ├── src/config/           # Tier limits (Free/Pro), startup validation
│   │   │   ├── public/               # Static HTML/CSS/JS served by Express
│   │   │   └── test/                 # Vitest test files
│   │   └── logic-commons/            # Shared auth service
│   │       ├── src/routes/           # token-exchange.ts, login.ts
│   │       └── src/lib/              # oauth.ts, refresh-store.ts, audit-store.ts, state-store.ts
│   ├── packages/
│   │   ├── core/                     # @publiclogic/core — JWT, CSRF, cookie, auth middleware
│   │   │   └── src/                  # jwt.ts, auth.ts, middleware.ts, cookie.ts
│   │   └── vault/                    # @puddlejumper/vault — compliance engine
│   │       └── src/                  # auditLedger.ts, manifestRegistry.ts, policyProvider.ts, schema.ts
│   ├── web/                          # Next.js 16 frontend (uses npm, NOT pnpm)
│   │   └── src/app/                  # App Router pages: dashboard, governance, approvals, vault, admin, login
│   ├── docs/                         # Architecture, deployment, system contract, user guides
│   ├── ops/                          # Operational docs (DR, handoff, readiness, architecture north star)
│   ├── fly.toml                      # Fly.io deployment config
│   ├── Dockerfile                    # Production container
│   ├── docker-compose.yml            # Local Docker setup
│   └── .env.sample                   # All environment variables documented
├── publiclogic-os-ui/                # PublicLogic OS frontend (vanilla JS, MSAL, hash routing)
│   ├── app.js                        # Main app + route table (PAGES object)
│   ├── pages/                        # 10 pages (dashboard, agenda, tasks, puddlejumper, etc.)
│   └── lib/                          # auth.js, graph.js, sharepoint.js, pj.js (SSO bridge)
├── chamber-connect/                  # Case management prototype (Express, JSON datastore)
├── live-edit-deploy-console/         # Tenebrux Veritas deployment engine (React+Vite client, Express server)
├── publiclogic-operating-system/     # Canonical playbook source (JSON)
├── publiclogic-site/                 # Marketing site
├── scripts/                          # sync-playbooks.sh (canonical→copies, drift detection)
├── tests/                            # E2E tests (Playwright)
├── FEATURES.md                       # 23 novel features catalog
└── README.md                         # Repo overview
```

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Backend runtime | Node.js 20.x | ES modules (`"type": "module"`) |
| Backend language | TypeScript 5.7+ | Strict mode, no `any` |
| Backend framework | Express 4.x | |
| Database | SQLite via better-sqlite3 | NOT Postgres. Synchronous API. |
| Package manager (backend) | pnpm 8.15.8 | Via `corepack enable`. Workspace: `pnpm-workspace.yaml` |
| Package manager (frontend) | npm | `n8drive/web/` has its own `package-lock.json`. Never use pnpm here. |
| Frontend framework | Next.js 16.x | App Router, React 19, TypeScript |
| Frontend styling | Tailwind CSS 4.x | zinc/emerald palette, Geist font |
| OS UI | Vanilla JS | Hash routing, MSAL auth. No React. |
| Testing | Vitest | Comprehensive suite. Some known pre-existing failures exist — only fix failures related to your changes. |
| Auth | JWT (jose) + OAuth | HS256/RS256. Cookie-first, then Bearer header. |
| Deployment | Fly.io (backend), Vercel (frontend) | Docker also supported |

## Commands You Need

```bash
# ── Backend ──────────────────────────────────────
cd n8drive
pnpm install                    # Install all workspace deps
pnpm run dev                    # Start PuddleJumper server (port 3002)
pnpm run build                  # Build all packages
pnpm run build:pj               # Build PuddleJumper only
pnpm run test                   # Run all tests
pnpm run test:pj                # Test PuddleJumper only
pnpm run test:core              # Test core package

# ── Frontend ─────────────────────────────────────
cd n8drive/web
npm ci                          # Install (MUST use npm)
npm run dev                     # Start Next.js dev server (port 3000)
npm run build                   # Production build
./node_modules/.bin/tsc --noEmit # TypeScript check

# ── Playbook sync ────────────────────────────────
./scripts/sync-playbooks.sh          # Sync from canonical source
./scripts/sync-playbooks.sh --check  # CI drift check (exit 1 if diverged)
```

## Architecture — The Three Separations

PuddleJumper enforces three architectural boundaries. Never merge them:

### 1. Decision ↔ Execution (Governance Engine ↔ Dispatch)

The **governance engine** (`governanceEngine.ts`) evaluates intents and produces a plan. The **dispatch layer** (`dispatch.ts` + `dispatchers/`) executes plans against external connectors. They never call each other directly — the approval store sits between them.

Intent tiers:
- **Launcher** (`open_repository`, `open_365_location`, `run_automation`, `health_check`) → fast-path, no approval needed
- **Governed** (`create_environment`, `deploy_policy`, `seal_record`) → requires approval chain
- **Legacy** (`route`, `name`, `file`, `notify`, `escalate`, `lock`, `start_clock`, `generate`, `archive`, `gate`, `export`) → backward-compatible, treated as governed

### 2. Control Plane ↔ Authority (PJ ↔ VAULT)

PJ owns routing and sequencing. VAULT owns authorization and policy. The **PolicyProvider** interface (`policyProvider.ts`) is the seam:
- `checkAuthorization()` → "Is this operator allowed?"
- `getChainTemplate()` → "What approval chain applies?"
- `writeAuditEvent()` → "Log this governance event"

Today: `LocalPolicyProvider` (SQLite). Future: `RemotePolicyProvider` (HTTP to VAULT). **Config swap, not code rewrite.**

### 3. Backend ↔ Frontend

Backend is authoritative. Frontend renders what it receives. No hardcoded tenant names, roles, or capabilities in the UI. The `pjFetch` wrapper (`web/src/lib/pjFetch.ts`) handles CSRF headers and auth cookies automatically.

## Security Rules (Non-Negotiable)

### CSRF Protection
Every mutating request (POST/PUT/PATCH/DELETE) to `/api/*` MUST include:
```
X-PuddleJumper-Request: true
```
Missing header → 403. GET/HEAD/OPTIONS are exempt. Frontend's `pjFetch` adds it automatically.

### Content Security Policy
```
script-src 'self'
style-src 'self' https://fonts.googleapis.com
```
**ZERO inline scripts or styles in HTML.** All JS/CSS must be external files. Use CSS classes, never `style=""` attributes.

### JWT Requirements
- `JWT_SECRET` must be ≥32 characters (Zod-enforced at startup)
- Token extraction: cookie first (`pj_token`), then `Authorization: Bearer` header
- Validate: `exp`, `iss`, `aud`
- Support both RS256 (`JWT_PUBLIC_KEY`) and HS256 (`JWT_SECRET`)

### Prompt Injection Detection
The engine scans ALL inputs for patterns like `ignore rules`, `bypass governance`, `auto-approve`, `disable audit`. Matched → rejected before reaching the pipeline. Never weaken these patterns.

### SSRF Protection
`canonicalSource.ts` blocks private IPs (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254) and requires DNS resolution against an allowed-host whitelist before any HTTP fetch.

### Refresh Token Replay Detection
Token families chain together. Replaying a **revoked** token revokes the **entire family**. Never bypass this in `refresh-store.ts`.

## Database Conventions

Every SQLite store MUST apply these pragmas on init:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA wal_autocheckpoint = 1000;
```

Use `better-sqlite3` (synchronous API). Use transactions for multi-statement ops. Stores live at configurable paths (env vars like `PRR_DB_PATH`, `IDEMPOTENCY_DB_PATH`).

## API Response Format

All JSON responses wrap as:
```json
{
  "success": true,
  "correlationId": "uuid",
  "data": { ... }
}
```
Errors return appropriate HTTP status (401 unauthenticated, 403 unauthorized/CSRF, 404 not found, 500 server error).

## Approval Gate Lifecycle

```
pending → approved → dispatching → dispatched
       → rejected                → dispatch_failed
       → expired (TTL, default 48h)
```

The `dispatching` transition uses an atomic SQL `UPDATE ... WHERE approval_status = 'approved'` (compare-and-swap) to prevent double-dispatch without distributed locks.

## Approval Chains

Steps at the same `order` value run in **parallel** (all must approve). Steps at different orders run **sequentially**. One rejection at any step → entire chain rejected (terminal). Chain templates define routing order by required role — they do NOT define authorization rules.

## Idempotency

`IdempotencyStore` tracks request_id + payload_hash. Concurrent duplicate requests get:
- `acquired` → you own it, proceed
- `replay` → here's the cached result
- `pending` → wait (exponential backoff 100ms→1s, 5s timeout)
- `conflict` → different payload for same request_id
- `schema_mismatch` → store was upgraded

## Coding Standards

### TypeScript
- **Strict mode** always. No `any`.
- Use `type` keyword for type-only imports: `import type { Foo } from "./bar.js"`
- ES modules everywhere: `"type": "module"` in package.json
- File extensions in imports: `"./foo.js"` (even for .ts files)

### Naming
- Files: `kebab-case.ts` (e.g., `approval-store.ts`)
- Functions: `camelCase`
- Classes: `PascalCase`
- Constants/env vars: `UPPER_SNAKE_CASE`

### CSS Design System
All backend HTML uses these CSS variables (matches frontend's Tailwind zinc/emerald):
```css
--bg: #09090b;
--surface: #18181b;
--border: #27272a;
--accent: #10b981;
--radius: 12px;
```

### Tests
Use Vitest. Use supertest for API endpoint testing. Follow existing patterns — don't invent new test frameworks. Only fix test failures related to your changes.

## Key Features to Know About

1. **Fail-closed governance** — default deny, every action validated through intent → charter → authority → plan pipeline
2. **Multi-step approval chains** — parallel + sequential steps with role-based routing
3. **Dispatch isolation** — connectors (GitHub, SharePoint, Slack, webhooks) execute plans through a standard interface
4. **Idempotency with in-flight dedup** — prevents duplicate processing with result replay
5. **PolicyProvider seam** — swap Local→Remote with config, not code
6. **VAULT compliance engine** — append-only audit, manifest registry, M.G.L. citations
7. **Deterministic plan hashing** — SHA-256 of canonicalized JSON for tamper detection
8. **Statutory retention mapping** — documents auto-routed with ISO 8601 retention periods
9. **Tier-based quotas** — Free/Pro limits on templates, approvals, members
10. **PRR workflow** — public records requests with statutory due-date calculation
11. **SSO token exchange** — MSAL→PJ session bridge via `/api/auth/token-exchange`
12. **Generic OAuth factory** — declarative provider config, tenant-aware dynamic URLs
13. **Charter validation** — workspace must confirm authority, accountability, boundary, continuity
14. **Approval metrics** — Prometheus-compatible counters, gauges, histograms
15. **Deep + shallow health checks** — `/health` (DB+volume+secrets) vs `/ready` (DB ping)
16. **Playbook sync with drift detection** — canonical source → 2 copies, CI checks for divergence

## Environment Variables (Dev Essentials)

```bash
NODE_ENV=development
PORT=3002
CONTROLLED_DATA_DIR=./data
JWT_SECRET=dev-secret-at-least-32-characters-long
AUTH_ISSUER=puddle-jumper
AUTH_AUDIENCE=puddle-jumper-api
ALLOW_ADMIN_LOGIN=true           # Required for local /api/login
PJ_PUBLIC_URL=http://localhost:3002
PJ_UI_URL=http://localhost:3000
PJ_ALLOWED_PARENT_ORIGINS=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
# Full reference: n8drive/.env.sample
```

## DNS & Deployment Topology

```
pj.publiclogic.org    → Vercel  (Next.js frontend)
api.publiclogic.org   → Fly.io  (Express backend, SQLite on persistent volume)
publiclogic.org       → Vercel  (marketing site)
```

Fly.io config: 1 CPU, 1GB RAM, EWR region, `/data` persistent volume, `min_machines_running=1`.

## Document References

| Doc | What it covers |
|---|---|
| `FEATURES.md` | 23 novel features catalog |
| `.github/copilot-instructions.md` | GitHub Copilot-specific guidance |
| `n8drive/SECURITY.md` | Full security model |
| `n8drive/docs/PJ_SYSTEM_CONTRACT.md` | Non-negotiable development rules |
| `n8drive/ops/ARCHITECTURE-NORTH-STAR.md` | 90-day strategic roadmap |
| `n8drive/ENV_REFERENCE.md` | All environment variables |
| `n8drive/.env.sample` | Copy-paste dev environment |
| `n8drive/LAUNCH_CHECKLIST.md` | Production go-live gates |
| `n8drive/ops/DISASTER-RECOVERY.md` | RTO ≤30min, RPO ≤6h |
| `n8drive/ops/OPERATIONAL-HANDOFF.md` | Bus-factor documentation |
| `n8drive/ops/MUNICIPAL-READINESS.md` | 3-tier readiness (Alpha→Pilot→Production) |

## What Not to Do

- **Don't use Postgres or Supabase.** The database is SQLite on a persistent volume. That's the architecture.
- **Don't use React in OS UI.** It's vanilla JS with hash routing. Keep it that way.
- **Don't mix package managers.** pnpm for `n8drive/`, npm for `n8drive/web/`. Never cross them.
- **Don't inline scripts or styles.** CSP blocks them. External files only.
- **Don't hardcode tenant context.** Everything resolves from the backend at runtime.
- **Don't merge PJ and VAULT.** They are separate by design. The PolicyProvider interface is the only bridge.
- **Don't weaken injection detection patterns.** They protect the governance pipeline.
- **Don't skip the CSRF header.** Every POST/PUT/PATCH/DELETE to `/api/*` needs `X-PuddleJumper-Request: true`.
- **Don't fix unrelated test failures.** Some pre-existing failures exist. Only fix failures related to your changes.
