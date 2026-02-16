# PuddleJumper

## Quick Start & Systems Map

### Admin Workspace

## Quick Start

PuddleJumper is a governance control plane that sits between AI agents (or human operators) and production systems. Every action passes through an approval gate before being dispatched to its target connector.

### 1 — Authenticate

Sign in via GitHub, Google, or Microsoft OAuth at `/pj`. Tokens are JWT-based with role + tenant scoping.

### 2 — Submit an action

POST to `/api/pj/execute` with an intent, mode, and plan. The governance engine evaluates it and creates an approval request.

### 3 — Approval chain

If a chain template is assigned, approval routes through sequential or parallel steps. Each step is decided independently. All steps at the same order must approve before the next order activates.

### 4 — Decide

Approve or reject via the Admin UI or `POST /api/approvals/:id/decide`. Rejections are terminal — all subsequent steps are skipped.

### 5 — Dispatch

Once fully approved, dispatch sends the action to a registered connector: GitHub, Slack, or a generic webhook. Retries use exponential backoff.

### 6 — Monitor

Track metrics on the Admin Dashboard. Prometheus-format metrics are available at `/metrics`. Health checks at `/health`.

## Local development

```bash
# From monorepo root
pnpm install
cd apps/puddlejumper

# Set minimum env vars
export JWT_SECRET=dev-secret
export AUTH_ISSUER=dev
export AUTH_AUDIENCE=dev

# Start
npx tsx src/api/server.ts
# → http://localhost:3002/pj
```

## Deploy (Fly.io)

```bash
# From monorepo root (/n8drive)
fly deploy --app publiclogic-puddlejumper
```

---

## Systems Map

```
Clients
├── PJ Workspace UI
├── Admin UI
├── AI Agent / CLI
└── Webhook Consumer

    ↕ HTTPS + JWT

API Layer (Express)
├── Auth & OAuth
├── Config & Capabilities
├── PRR Intake
├── Access Requests
├── Governance / Execute
├── Approvals
├── Chain Templates
├── Webhook Actions
├── Admin Stats
└── Connectors

    ↕

Engine
├── Governance Engine
├── Approval Store
├── Chain Store
├── Dispatcher Registry
├── Approval Metrics
├── Validation
└── Idempotency Store

    ↕

Data Stores (SQLite WAL)
├── prr.db
├── approvals.db
├── connectors.db
└── oauth_state.db

    ↕

Dispatch Targets
├── GitHub (Issues/PRs)
├── Slack (Messages)
└── Webhook (HTTP POST)
```

## Monorepo structure

```
n8drive/
├── packages/core/          @publiclogic/core — JWT auth, middleware, CSRF
├── apps/logic-commons/     @publiclogic/logic-commons — OAuth providers, session routes
├── apps/puddlejumper/      The control plane application
│   ├── public/             Static assets (admin.html, guide.html, workspace)
│   ├── src/api/            Express server, routes, middleware
│   │   ├── server.ts       App factory + route wiring
│   │   └── routes/         auth, config, prr, access, governance,
│   │                       approvals, chainTemplates, admin, webhookAction
│   ├── src/engine/         Business logic
│   │   ├── approvalStore   Approval CRUD + status machine
│   │   ├── chainStore      Chain templates, steps, parallel progression
│   │   ├── dispatch        DispatcherRegistry + GitHub/Slack/Webhook dispatchers
│   │   ├── governanceEngine  Policy evaluation + approval gate
│   │   └── approvalMetrics Prometheus-format counters & histograms
│   └── test/               309 tests across 22 files
├── Dockerfile              Multi-stage build (Fly.io)
└── fly.toml                Deployment config (app: publiclogic-puddlejumper)
```

---

## API Reference

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/login` | public | Built-in login (dev/test) |
| GET | `/api/auth/github/login` | public | GitHub OAuth redirect |
| GET | `/api/auth/google/login` | public | Google OAuth redirect |
| GET | `/api/auth/microsoft/login` | public | Microsoft OAuth redirect |
| GET | `/api/auth/status` | public | Current auth state |
| GET | `/api/session` | public | Session info |
| POST | `/api/refresh` | public | Refresh JWT |
| GET | `/api/identity` | user | Current identity |
| POST | `/api/auth/logout` | public | Logout + revoke |

### Governance

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/pj/execute` | user | Submit action for governance evaluation |
| GET | `/api/prompt` | admin | System prompt |
| GET | `/api/core-prompt` | user | Core prompt |
| POST | `/api/evaluate` | deploy | Evaluate action against policies |
| GET | `/api/pj/identity-token` | optional | MS Graph identity exchange |

### Approvals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/approvals` | user | List approvals (filter by status) |
| GET | `/api/approvals/:id` | user | Get approval detail |
| POST | `/api/approvals/:id/decide` | user | Approve or reject (chain-aware) |
| POST | `/api/approvals/:id/dispatch` | user | Dispatch approved action to connector |
| GET | `/api/approvals/:id/chain` | user | Chain progress for approval |
| GET | `/api/approvals/count/pending` | user | Count of pending approvals |

### Chain Templates

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/chain-templates` | admin | List all templates |
| GET | `/api/chain-templates/:id` | admin | Get single template |
| POST | `/api/chain-templates` | admin | Create template (supports parallel steps) |
| PUT | `/api/chain-templates/:id` | admin | Update template |
| DELETE | `/api/chain-templates/:id` | admin | Delete template |

### Config & Operational

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/runtime/context` | user | Runtime context |
| GET | `/api/config/tiles` | user | UI tiles config |
| GET | `/api/config/capabilities` | user | Capabilities list |
| GET | `/api/capabilities/manifest` | user | Full capability manifest |
| GET | `/api/pj/actions` | user | Available actions |
| GET | `/api/admin/stats` | admin | Operational dashboard stats |
| GET | `/api/admin/audit` | admin | Auth audit log |
| GET | `/health` | public | Health check (db + secrets) |
| GET | `/metrics` | token | Prometheus metrics |

### PRR & Access

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/prr/intake` | optional | Submit PRR |
| GET | `/api/prr` | user | List PRRs |
| POST | `/api/prr/:id/status` | user | Update PRR status |
| POST | `/api/prr/:id/close` | user | Close PRR |
| POST | `/api/access/request` | optional | Submit access request |
| POST | `/api/access/request/:id/status` | user | Update access request status |
| POST | `/api/access/request/:id/close` | user | Close access request |
| POST | `/api/pj/actions/webhook` | user | Fire webhook action |

---

## Parallel Approval Chains

Chain templates support both sequential and parallel step routing. Steps sharing the same `order` value run in parallel.

### How it works

- Steps at order N all activate simultaneously when order N is reached
- Each step is decided independently (different approvers can act concurrently)
- All steps at order N must be approved before order N+1 activates
- A rejection at any step is terminal — active siblings and all subsequent steps are skipped

### Example template

```json
{
  "name": "Dual-review then release",
  "steps": [
    { "label": "Security Review", "approverRole": "security", "order": 0 },
    { "label": "Legal Review",    "approverRole": "legal",    "order": 0 },
    { "label": "Release Manager", "approverRole": "release",  "order": 1 }
  ]
}
// Step 0: Security + Legal run in parallel
// Step 1: Release Manager runs only after both order-0 steps approve
```

---

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for signing JWTs (required) |
| `AUTH_ISSUER` | JWT issuer claim |
| `AUTH_AUDIENCE` | JWT audience claim |
| `GITHUB_CLIENT_ID` / `_SECRET` | GitHub OAuth app credentials |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google OAuth credentials |
| `MICROSOFT_CLIENT_ID` / `_SECRET` | Microsoft OAuth credentials |
| `CONNECTOR_STATE_SECRET` | HMAC key for connector state integrity |
| `METRICS_TOKEN` | Bearer token for `/metrics` scraping (optional) |
| `PORT` | Server port (default: 3002) |
| `NODE_ENV` | `production` \| `development` \| `test` |

---

PuddleJumper Control Plane · 309 tests · Deployed on Fly.io as `publiclogic-puddlejumper`