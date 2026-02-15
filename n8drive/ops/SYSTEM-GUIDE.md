# PuddleJumper — System User Guide

> **Version:** February 2026  
> **Frontend:** https://pj.publiclogic.org  
> **Backend API:** https://publiclogic-puddlejumper.fly.dev  
> **Repository:** https://github.com/97n8/puddlejumper

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Authentication & Login](#authentication--login)
4. [The PuddleJumper Workspace](#the-puddlejumper-workspace)
5. [Governance Engine](#governance-engine)
6. [Approval Gate & Dispatch](#approval-gate--dispatch)
7. [Connectors](#connectors)
8. [API Reference](#api-reference)
9. [Metrics & Observability](#metrics--observability)
10. [Ops & Runbooks](#ops--runbooks)
11. [Development & Testing](#development--testing)

---

## System Overview

PuddleJumper is a governance-first decision engine for municipal policy operations. It evaluates operator actions through a fail-closed rule pipeline and, for governed actions, requires human approval before dispatching changes to external systems (GitHub, SharePoint, etc.).

**Key capabilities:**

- **Governance engine** — 1300+ line fail-closed evaluation pipeline
- **Human-in-the-loop approvals** — admin review before external dispatch
- **Multi-provider OAuth** — GitHub, Google, Microsoft SSO
- **Connector dispatch** — execute approved plans via GitHub PRs, direct commits, etc.
- **Prometheus metrics** — counters, gauges, histograms for approval & dispatch lifecycle
- **Tile-based workspace** — configurable dashboard with live capabilities

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (pj.publiclogic.org)                                  │
│  PuddleJumper Workspace — tile-based dashboard                  │
└──────────────┬──────────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────────────────┐
│  Backend (publiclogic-puddlejumper.fly.dev)                     │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ Auth     │ │ Config   │ │ PRR/Access│ │ Governance       │  │
│  │ (OAuth,  │ │ (tiles,  │ │ (intake,  │ │ (execute,        │  │
│  │  JWT,    │ │  caps,   │ │  request) │ │  evaluate,       │  │
│  │  refresh)│ │  actions)│ │           │ │  approval gate)  │  │
│  └──────────┘ └──────────┘ └───────────┘ └────────┬─────────┘  │
│                                                    │            │
│  ┌─────────────────────────────────────────────────▼─────────┐  │
│  │ Approval Store (SQLite)                                   │  │
│  │  pending → approved → dispatching → dispatched            │  │
│  └─────────────────────────────────────────────────┬─────────┘  │
│                                                    │            │
│  ┌─────────────────────────────────────────────────▼─────────┐  │
│  │ Dispatch Pipeline                                         │  │
│  │  DispatcherRegistry → ConnectorDispatchers (GitHub, ...)  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Storage: SQLite (WAL mode) — approvals, PRRs, connectors, audit│
└─────────────────────────────────────────────────────────────────┘
```

**Tech stack:** TypeScript (ES2022/NodeNext), Express 4, better-sqlite3, jose (JWT), Fly.io

---

## Authentication & Login

### OAuth Providers

PuddleJumper supports three OAuth providers. Users click a login button and are redirected through the standard OAuth flow:

| Provider | Login URL | Notes |
|----------|-----------|-------|
| GitHub | `/api/auth/github/login` | Redirects to GitHub OAuth |
| Google | `/api/auth/google/login` | Redirects to Google OAuth |
| Microsoft | `/api/auth/microsoft/login` | Redirects to Microsoft OAuth |

After successful OAuth, the user receives a JWT (access token) and a refresh token (HTTP-only cookie).

### Session Lifecycle

| Action | Endpoint | Method |
|--------|----------|--------|
| Check session | `/api/auth/status` | GET |
| View identity | `/api/identity` | GET |
| Refresh token | `/api/refresh` | POST |
| Logout | `/api/auth/logout` | POST |
| Revoke all tokens | `/api/auth/revoke` | POST |

### Roles

| Role | Capabilities |
|------|-------------|
| `admin` | Full access — approve/reject/dispatch, view audit logs, view system prompt |
| `viewer` | Read-only — see own approvals, submit PRRs, request access |

### Security Headers

All `/api` routes require the CSRF header:

```
X-PuddleJumper-Request: true
```

---

## The PuddleJumper Workspace

The workspace is the primary user interface, served at `/pj` (also `/puddle-jumper`, `/pj-workspace`).

It renders a tile-based dashboard with live capabilities, configuration, and action shortcuts. The tile configuration is managed server-side and returned via:

- `GET /api/config/tiles` — tile layout and content
- `GET /api/config/capabilities` — runtime capabilities
- `GET /api/capabilities/manifest` — action definitions and permissions
- `GET /api/pj/actions` — available PJ actions for the current user

---

## Governance Engine

The governance engine is the core of PuddleJumper. Every operator action passes through a fail-closed evaluation pipeline.

### Action Modes

| Mode | Behavior |
|------|----------|
| `governed` | Full pipeline — engine evaluates, then requires human approval before dispatch |
| `launch` | Engine evaluates and returns result directly (no approval gate) |
| `dry-run` | Engine evaluates but does not create approvals or dispatch |

### Execute Flow

```
POST /api/pj/execute
  ├─ Engine evaluates action through rule pipeline
  ├─ If mode = "dry-run" → returns result immediately (200)
  ├─ If mode = "governed" and approved by engine:
  │   ├─ Creates approval record (status: "pending")
  │   ├─ Returns 202 Accepted with approvalId
  │   └─ Awaits human sign-off before any external action
  └─ If denied by engine → returns denial (403 or 422)
```

### Evaluate (standalone)

```
POST /api/evaluate
```

Runs the governance pipeline without creating approvals. Requires the `deploy` permission.

---

## Approval Gate & Dispatch

### Lifecycle

```
1. Engine approves (governed)  →  Approval created (PENDING)
2. Admin reviews              →  POST /api/approvals/:id/decide
3. Decision:
   ├─ approved  →  status = APPROVED
   └─ rejected  →  status = REJECTED (terminal)
4. Admin dispatches            →  POST /api/approvals/:id/dispatch
5. CAS lock acquired           →  status = DISPATCHING
6. Dispatch pipeline runs      →  connectors execute plan steps
7. Result:
   ├─ all steps succeed  →  status = DISPATCHED (terminal)
   └─ any step fails     →  status = DISPATCH_FAILED (terminal)
```

### Approval API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/approvals` | Logged in (admin sees all, others see own) | List approvals. Query: `?status=pending&limit=50&offset=0` |
| GET | `/api/approvals/:id` | Logged in | Single approval with full plan/audit/decision data |
| POST | `/api/approvals/:id/decide` | Admin only | `{ "status": "approved" or "rejected", "note": "..." }` |
| POST | `/api/approvals/:id/dispatch` | Admin only | `{ "dryRun": true/false }` — executes the approved plan |
| GET | `/api/approvals/count/pending` | Logged in | `{ "pendingCount": number }` |

### How to approve and dispatch (step-by-step)

1. **Execute a governed action:**
   ```bash
   curl -X POST $BASE/api/pj/execute \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-PuddleJumper-Request: true" \
     -H "Content-Type: application/json" \
     -d '{"mode":"execute","action":{"intent":"deploy_policy",...}}'
   # → 202 { approvalRequired: true, approvalId: "abc-123" }
   ```

2. **Review the approval:**
   ```bash
   curl $BASE/api/approvals/abc-123 \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-PuddleJumper-Request: true"
   ```

3. **Approve it:**
   ```bash
   curl -X POST $BASE/api/approvals/abc-123/decide \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-PuddleJumper-Request: true" \
     -H "Content-Type: application/json" \
     -d '{"status":"approved","note":"Reviewed and looks good"}'
   ```

4. **Dispatch:**
   ```bash
   curl -X POST $BASE/api/approvals/abc-123/dispatch \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-PuddleJumper-Request: true" \
     -H "Content-Type: application/json" \
     -d '{}'
   # → 200 { success: true, data: { dispatchResult: {...}, approvalStatus: "dispatched" } }
   ```

### Double-Dispatch Protection

The `consumeForDispatch()` method uses an atomic CAS (Compare-And-Swap) operation:

```sql
UPDATE approvals SET approval_status = 'dispatching'
WHERE id = ? AND approval_status = 'approved'
```

Only one caller wins. The loser gets a 409 Conflict response.

---

## Connectors

Connectors link PuddleJumper to external services for dispatching approved plans.

| Provider | Operations | Status |
|----------|-----------|--------|
| GitHub | `prepare_branch_and_pr`, `prepare_direct_commit` | Active |
| Microsoft (SharePoint) | Planned | — |
| Google | Planned | — |

### Connector Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/connectors/` | List connected providers |
| POST | `/api/connectors/:provider/auth/start` | Begin connector OAuth flow |
| GET | `/api/connectors/:provider/auth/callback` | OAuth callback |
| POST | `/api/connectors/:provider/disconnect` | Remove connector |
| GET | `/api/connectors/:provider/resources` | List available resources (repos, etc.) |

---

## API Reference

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check (DB, secrets) |
| GET | `/metrics` | Prometheus metrics (optional `METRICS_TOKEN` auth) |
| GET | `/pj` | PuddleJumper workspace HTML |
| GET | `/api/auth/status` | Session probe (never 401s) |
| GET | `/api/auth/{github,google,microsoft}/login` | OAuth login redirect |
| GET | `/api/auth/{github,google,microsoft}/callback` | OAuth callback |
| POST | `/api/login` | Built-in username/password login |
| POST | `/api/refresh` | Token refresh (reads cookie) |
| POST | `/api/auth/logout` | Logout + clear cookies |
| POST | `/api/prr/intake` | Submit a PRR (public intake) |
| POST | `/api/access/request` | Submit an access request |
| GET | `/api/public/prrs/:publicId` | View a PRR by public ID |

### Authenticated

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/identity` | Any | Current user identity |
| GET | `/api/runtime/context` | Any | Runtime context |
| GET | `/api/config/tiles` | Any | Tile configuration |
| GET | `/api/config/capabilities` | Any | Capabilities |
| GET | `/api/capabilities/manifest` | Any | Action manifest |
| GET | `/api/pj/actions` | Any | Available actions |
| POST | `/api/pj/execute` | Any | Execute governed action |
| POST | `/api/evaluate` | `deploy` permission | Standalone evaluation |
| GET | `/api/approvals` | Any (scoped) | List approvals |
| GET | `/api/approvals/:id` | Any (scoped) | Get approval details |
| POST | `/api/approvals/:id/decide` | Admin | Approve or reject |
| POST | `/api/approvals/:id/dispatch` | Admin | Dispatch approved plan |
| GET | `/api/approvals/count/pending` | Any | Pending count |

### Admin Only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prompt` | View full system prompt |
| GET | `/api/admin/audit` | Query audit event log |

---

## Metrics & Observability

### Prometheus Endpoint

```
GET /metrics
Authorization: Bearer <METRICS_TOKEN>    (if METRICS_TOKEN env is set)
Content-Type: text/plain; version=0.0.4
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `approvals_created_total` | counter | Approvals created |
| `approvals_approved_total` | counter | Approvals approved |
| `approvals_rejected_total` | counter | Approvals rejected |
| `approvals_expired_total` | counter | Approvals expired |
| `approval_pending_gauge` | gauge | Current pending count |
| `approval_time_seconds` | histogram | Time to decision |
| `dispatch_success_total` | counter | Successful dispatches |
| `dispatch_failure_total` | counter | Failed dispatches |
| `dispatch_latency_seconds` | histogram | Dispatch duration |
| `consume_for_dispatch_success_total` | counter | CAS lock successes |
| `consume_for_dispatch_conflict_total` | counter | CAS conflicts |

### Grafana Dashboard

Import `ops/grafana/puddlejumper-approvals-dashboard.json` into Grafana.

**7 panels:** approval rates, pending gauge, approval latency (p50/p95), CAS conflicts, dispatch success rate, dispatch latency, backlog trend.

**4 Grafana-native alerts:** backlog high, approval latency, CAS conflicts, dispatch failures.

### Alert Rules

See `ops/alerts/approval-alerts.yml` for Prometheus alert rules (6 rules).

| Alert | Fires when |
|-------|-----------|
| `ApprovalsBacklogHigh` | Pending > 10 for 10 minutes |
| `DispatchFailuresSpike` | > 5 dispatch failures in 5 minutes |
| `ConsumeForDispatchConflictsSpike` | > 5 CAS conflicts in 5 minutes |
| `ApprovalTimeTooHigh` | p95 decision time > 10 minutes |
| `DispatchLatencyHigh` | p95 dispatch > 60 seconds |
| `NoApprovalsProcessed` | Creating but not deciding for 24 hours |

---

## Ops & Runbooks

### Key Links

| Resource | Location |
|----------|----------|
| **Production** | https://publiclogic-puddlejumper.fly.dev |
| **Frontend** | https://pj.publiclogic.org |
| **Health check** | https://publiclogic-puddlejumper.fly.dev/health |
| **Metrics** | https://publiclogic-puddlejumper.fly.dev/metrics |
| **Repository** | https://github.com/97n8/puddlejumper |
| **Fly dashboard** | `fly status --app publiclogic-puddlejumper` |
| **Fly logs** | `fly logs --app publiclogic-puddlejumper` |

### Ops Tree

```
ops/
  alerts/approval-alerts.yml          ← Prometheus alert rules (6 rules)
  alertmanager/alertmanager.yml       ← PagerDuty + Slack routing config
  grafana/
    puddlejumper-approvals-dashboard.json  ← 7-panel dashboard + 4 alerts
    provisioning/
      dashboards.yml                  ← Auto-import into Grafana
      datasources.yml                 ← Prometheus datasource template
  runbooks/approvals.md               ← Full operational runbook
  sanity-test.sh                      ← Quick smoke test script
  SYSTEM-GUIDE.md                     ← This file
```

### Sanity Test

Run the smoke test against production or a local instance:

```bash
# Production (unauthenticated tests only)
./ops/sanity-test.sh

# With admin token (full test suite)
ADMIN_TOKEN="your-jwt" ./ops/sanity-test.sh

# Local dev
BASE=http://localhost:3002 ./ops/sanity-test.sh

# With metrics auth
METRICS_TOKEN="xxx" ADMIN_TOKEN="yyy" ./ops/sanity-test.sh
```

### Deploy

```bash
cd /Users/n8/puddlejumper/n8drive
fly deploy --app publiclogic-puddlejumper --no-cache
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing secret |
| `AUTH_ISSUER` | Yes | JWT issuer |
| `AUTH_AUDIENCE` | Yes | JWT audience |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | Yes | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | Yes | Microsoft OAuth client secret |
| `CONNECTOR_STATE_SECRET` | Yes | HMAC key for connector OAuth state |
| `METRICS_TOKEN` | No | Bearer token to protect `/metrics` |
| `PORT` | No | Server port (default: 3002) |
| `NODE_ENV` | No | `production` / `development` |

---

## Development & Testing

### Monorepo Structure

```
n8drive/
  packages/
    core/                  ← @publiclogic/core (JWT, middleware, auth)
  apps/
    puddlejumper/          ← Main app (Express server, governance, approvals)
    logic-commons/         ← @publiclogic/logic-commons (OAuth factory, shared utils)
```

### Commands

```bash
# Install dependencies
pnpm install

# Build
pnpm --filter puddlejumper run build

# Test (vitest)
pnpm --filter puddlejumper run test

# Run locally
PORT=3002 JWT_SECRET=dev-secret AUTH_ISSUER=dev AUTH_AUDIENCE=dev pnpm --filter puddlejumper run dev
```

### Test Suite

**146 tests across 13 files:**

- `auth.test.ts` — JWT, login, refresh, revoke
- `routes-refresh-revoke.test.ts` — token rotation, replay detection, audit events
- `oauth-ratelimit.test.ts` — OAuth login rate limiting
- `health.test.ts` — health endpoint
- `approvalStore.test.ts` — SQLite CRUD, expiry, CAS
- `dispatch.test.ts` — dispatcher registry, plan execution
- `governance-gate.test.ts` — approval gate in execute handler
- `approval-e2e.test.ts` — full lifecycle (happy, reject, dispatch fail, dry-run, CAS, RBAC, metrics)
- Plus connector, PRR, access, and config tests
