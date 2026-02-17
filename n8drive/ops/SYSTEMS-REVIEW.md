# PuddleJumper — Systems Review

> **Date:** February 17, 2026
> **Version:** V1.0.0 (released Feb 16, 2026)
> **Branch:** `main` (green, Node 20)
> **Purpose:** Comprehensive review of delivered capabilities, architecture status vs. North Star roadmap, known gaps, and security posture.

---

## 1. Executive Summary

PuddleJumper V1.0 is a **working governance control plane** with multi-step approval chains, parallel approval support, a PolicyProvider interface, chain template CRUD, an admin UI with 5 tabs, and a Next.js launcher surface (PublicLogic Control Center). The system is deployed on Fly.io with SQLite (WAL mode) and has 507+ unit tests across 31 active test files.

The 90-day Architecture North Star roadmap is **substantially complete**: approval chains (Days 1–30), Control Plane UI + parallel approvals (Days 31–60), and the VAULT policy interface with LocalPolicyProvider (Days 61–90) are all delivered. What remains is operational hardening, test coverage for untested routes, and shipping deferred features (email invitations, audit log UI, multi-workspace).

---

## 2. Architecture Status vs. North Star

| North Star Deliverable | Status | Evidence |
|------------------------|--------|----------|
| Approval chain data model | ✅ Complete | `chainStore.ts` (669 lines), 37 store tests, 20 template tests |
| Chain progression logic | ✅ Complete | Sequential + parallel step routing, rejection propagation |
| API surface for chains | ✅ Complete | `/api/approvals/:id/chain`, `/api/approvals/:id/decide`, `/api/chain-templates` CRUD |
| Chain lifecycle tests | ✅ Complete | 84 chain-related tests (chainStore, chain-integration, chain-templates, chain-metrics, parallel-approval) |
| Control Plane UI — approval queue | ✅ Complete | Admin UI at `/pj/admin` with 5 tabs (approvals, connectors, metrics, members, usage) |
| Control Plane UI — operational dashboard | ✅ Complete | Admin stats endpoint, dispatch history, connector health |
| Parallel approval support | ✅ Complete | 22 parallel-approval tests + 15 parallel-agent-progress tests |
| PolicyProvider interface | ✅ Complete | `policyProvider.ts` (555 lines), 3 async methods, 38 tests |
| LocalPolicyProvider | ✅ Complete | SQLite-backed, used as VAULT stand-in |
| Governance engine consumes PolicyProvider | ✅ Complete | `governanceEngine.ts` (1327 lines) calls `policyProvider.getChainTemplate()` + `writeAuditEvent()` |
| Connector retry on registration | ✅ Complete | `dispatch.ts` (315 lines), exponential backoff, registry pattern |
| SharePoint dispatcher | ⚠️ Stub only | Stub in `dispatchers/sharepoint.ts`, dry-run supported, no real Graph API calls |
| VAULT as running service | ❌ Deferred | By design — interface defined, local provider ships, service deferred until customer needs compliance-grade audit separation |

### North Star Test Target

| Target | Actual | Status |
|--------|--------|--------|
| Days 1–30: 240+ tests | 507+ tests | ✅ Exceeded |
| Days 61–90: 280+ tests | 507+ tests | ✅ Exceeded |

---

## 3. Component Inventory

### Source Code

| Component | Files | Lines | Description |
|-----------|-------|-------|-------------|
| PJ App (src/) | 56 | ~12,400 | API server, routes, engine, middleware |
| PJ Tests | 31 active | ~9,400 | Unit + integration tests (Vitest) |
| Core package | — | ~240 | JWT auth, middleware, CSRF |
| Logic-Commons | — | ~1,300 | OAuth providers, session routes, refresh/audit stores |
| Web (Next.js) | 12 | — | PublicLogic Control Center launcher |

### Engine Layer (3,420 lines)

| Module | Lines | Tests | Purpose |
|--------|-------|-------|---------|
| `governanceEngine.ts` | 1,327 | 13 (governance-gate) | Fail-closed governance pipeline |
| `chainStore.ts` | 669 | 37 | Chain template + step storage, progression |
| `policyProvider.ts` | 555 | 38 | PolicyProvider interface + LocalPolicyProvider |
| `approvalStore.ts` | 326 | 21 | Approval CRUD + status machine |
| `dispatch.ts` | 315 | 12 + 28 | Dispatcher registry + webhook dispatch |
| `approvalMetrics.ts` | 228 | 5 | Prometheus-format counters + histograms |

### API Routes (2,240 lines)

| Route File | Lines | Tests | Endpoints |
|------------|-------|-------|-----------|
| `approvals.ts` | 466 | 9 (e2e) + 21 (store) | Approval CRUD, decide, dispatch, chain progress |
| `governance.ts` | 348 | 13 | `/api/pj/execute`, `/api/evaluate`, policy evaluation |
| `prrAdmin.ts` | 255 | 0 (skipped) | PRR admin management |
| `webhookAction.ts` | 201 | 28 | Governed webhook dispatch with retry |
| `chainTemplates.ts` | 200 | 20 | Chain template CRUD |
| `workspaceCollaboration.ts` | 144 | 32 | Member invite, accept, role management |
| `prr.ts` / `publicPrr.ts` | 236 | 0 (skipped) | Public records request intake + listing |
| `auth.ts` | 95 | 14 | Login, OAuth redirect |
| `admin.ts` | 86 | 8 | Admin stats, page serving |
| `config.ts` | 63 | 11 | Runtime context, capabilities, tiles |
| `workspaceUsage.ts` | 42 | 18 (tier) | Tier enforcement, usage tracking |
| `access.ts` | 104 | — | Access request handling |

### Middleware

| Module | Lines | Purpose |
|--------|-------|---------|
| `checkWorkspaceRole.ts` | ~45 | RBAC via workspace_members + JWT role fallback |
| `enforceTierLimit.ts` | ~40 | Free/Pro tier gate for template creation |
| `serverMiddleware.ts` | 281 | CSP headers, CORS, correlation ID, logging |

### Infrastructure

| Item | Status | Detail |
|------|--------|--------|
| Dockerfile | ✅ | Multi-stage build, Node 20, gosu for non-root |
| `entrypoint.sh` | ✅ | Writability checks, DATA_DIR setup |
| `fly.toml` | ✅ | Production deployment (Fly.io EWR) |
| `fly.staging.toml` | ✅ | Staging with explicit SQLite DB paths |
| CI (`ci.yml`) | ✅ | Build → typecheck → contract → test → Docker smoke |
| Grafana dashboard | ✅ | `puddlejumper-approvals-dashboard.json` |
| Alert rules | ✅ | `approval-alerts.yml` |
| Alertmanager | ✅ | `alertmanager.yml` |
| Runbooks | ✅ | `approvals.md`, `chain-stuck.md` |

---

## 4. Test Coverage Analysis

### By Category

| Category | Tests | Files | Coverage Assessment |
|----------|-------|-------|---------------------|
| Chain logic | 84 | 5 | ✅ Strong — store, templates, integration, metrics, parallel |
| PolicyProvider | 38 | 1 | ✅ Strong — interface, local provider, all 3 methods |
| Workspace/RBAC | 50 | 2 | ✅ Strong — collaboration + viewer role |
| Auth/OAuth | 37 | 4 | ✅ Good — auth routes, redirect, refresh, ratelimit |
| Approval lifecycle | 30 | 2 | ✅ Good — store + e2e |
| Dispatch | 44 | 3 | ✅ Good — registry, webhook, Slack |
| Admin | 8 | 1 | ✅ Adequate — stats, page serving, auth |
| Config/Health | 33 | 3 | ✅ Good — validation, startup, health |
| Tier enforcement | 18 | 1 | ✅ Good — free/pro limits |
| PRR routes | 0 | 2 (skipped) | ❌ Skipped — hardcoded file DB paths |

### Gaps

1. **PRR store + API tests**: `prr.store.test.ts` and `prr.api.test.ts` are `describe.skip()`. Requires PrrStore constructor to accept `dbPath` parameter (same pattern as ApprovalStore/ChainStore).
2. **No tests for `access.ts` routes**: Access request endpoints have no dedicated test file.
3. **No tests for `prrAdmin.ts`**: 255-line admin PRR route with no tests.
4. **SharePoint dispatcher**: Stub only — no integration tests possible until Graph API wiring.
5. **Web app**: No unit tests for React components or portalApps.ts logic.

---

## 5. Security Posture

### Current Strengths

| Area | Implementation | Status |
|------|---------------|--------|
| CSP | External CSS/JS only, `style-src 'self'`, `script-src 'self'` | ✅ Strict |
| CSRF | `X-PuddleJumper-Request` header required on mutating API calls | ✅ |
| Auth | Multi-provider OAuth (GitHub, Google, Microsoft) + httpOnly session cookies | ✅ |
| Session | Refresh token rotation, revocation on logout | ✅ |
| Workspace isolation | All API endpoints scoped to workspace via middleware | ✅ |
| Correlation IDs | Per-request UUID in `X-Correlation-Id` header | ✅ |
| Input validation | Zod schemas on all API inputs | ✅ |
| Rate limiting | OAuth login rate limiting | ✅ |

### Known Security Issues

| Issue | Severity | Detail | Mitigation |
|-------|----------|--------|------------|
| JWT hardcoded fallback | **High** | `packages/core/src/jwt.ts` falls back to `'dev-secret'` if `JWT_SECRET` env var is missing | Production deployments set `JWT_SECRET`; needs guard to throw in production |
| No audit log UI | Medium | Audit events logged but not viewable by operators | Events exist in SQLite; UI tab needed |
| Email invitation tokens | Low | Copy-link only — no actual email delivery | Acceptable for V1; track for V1.1 |

---

## 6. Deployment & Operations

### Current Topology

```
                Fly.io (EWR)
                ┌─────────────────────┐
                │  PuddleJumper       │
                │  (Express + SQLite) │
                │                     │
                │  /app/data/         │
                │   ├─ approvals.db   │
                │   ├─ prr.db         │
                │   ├─ connectors.db  │
                │   ├─ oauth_state.db │
                │   └─ ...            │
                └─────────────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         Vercel      GitHub     Slack
       (Next.js     (Dispatch   (Dispatch
        web app)    target)     target)
```

### Monitoring Stack

- **Metrics**: Prometheus-format at `/metrics` (bearer-token protected)
- **Dashboard**: Grafana with `puddlejumper-approvals-dashboard.json`
- **Alerts**: Prometheus alert rules in `ops/alerts/approval-alerts.yml`
- **Runbooks**: `ops/runbooks/approvals.md` (general), `chain-stuck.md` (>24h stuck chains)

### Health Check

- `GET /health` — public endpoint, checks DB connectivity + secret configuration
- Used by Fly.io for liveness probing

---

## 7. Known Gaps & Technical Debt

### P0 — Security

| Item | Effort | Detail |
|------|--------|--------|
| JWT production guard | Small | Throw error in `packages/core/src/jwt.ts` when `NODE_ENV=production` and `JWT_SECRET` is missing, instead of falling back to `'dev-secret'` |

### P1 — Test Coverage

| Item | Effort | Detail |
|------|--------|--------|
| Enable PRR tests | Medium | Add `dbPath` parameter to `PrrStore` constructor; write in-memory test suite following ApprovalStore/ChainStore pattern |
| Access route tests | Medium | Create `access.test.ts` covering request submission, status updates, close |
| PRR admin tests | Medium | Create `prr-admin.test.ts` covering admin PRR management endpoints |

### P2 — Feature Gaps (from V1 Known Issues)

| Item | Effort | Detail |
|------|--------|--------|
| Email invitations | Medium | Currently copy-link only; need SMTP integration or transactional email provider |
| Audit log UI | Medium | Admin tab to display audit events from SQLite; filterable by action, user, time |
| Multi-workspace | Large | Currently single workspace per user; requires workspace switcher + data partitioning |
| Workspace ownership transfer | Small | API endpoint + admin UI button for transferring workspace ownership |

### P3 — Operational Maturity

| Item | Effort | Detail |
|------|--------|--------|
| SharePoint dispatcher | Large | Wire Microsoft Graph API for document library + list operations |
| Billing integration | Large | Payment processing for Pro tier upgrades |
| Connector marketplace pattern | Medium | Deferred until 5+ active dispatchers (currently 3: GitHub, Slack, Webhook + 1 stub) |
| RemotePolicyProvider | Medium | HTTP-to-VAULT implementation of PolicyProvider interface; swap for LocalPolicyProvider |

---

## 8. Codebase Health Metrics

| Metric | Value |
|--------|-------|
| Total source lines (PJ app) | ~12,400 |
| Total test lines (PJ app) | ~9,400 |
| Test-to-source ratio | 0.76 |
| Active test files | 31 |
| Skipped test files | 2 (PRR) |
| Individual test cases | 447+ |
| Engine module lines | 3,420 |
| Route handler lines | 2,240 |
| Governance engine complexity | 1,327 lines (procedural, fail-closed — by design) |
| PolicyProvider interface | 3 async methods, 555 lines with local provider |
| Dispatchers | 4 (GitHub ✅, Webhook ✅, Slack ✅, SharePoint ⚠️ stub) |
| CI pipeline | Build → typecheck → contract → test → Docker smoke |
| Deployment | Fly.io (production + staging) |

---

## 9. Architectural Boundaries (Preserved)

The following boundaries from the Architecture North Star are **intact**:

1. **PJ/VAULT separation**: PJ defines routing/sequencing; authorization queries go through PolicyProvider interface. LocalPolicyProvider is the current stand-in. No policy definitions stored in PJ.

2. **Decision/Execution separation**: Governance engine evaluates and decides. Dispatch pipeline executes. Connectors are stateless executors.

3. **Fail-closed governance**: Every action is denied by default. The 1,327-line governance engine is procedural and explicit — not a plugin architecture or rule engine.

4. **Connectors are stateless**: GitHub, Webhook, Slack, and SharePoint dispatchers execute fully-specified instructions and return results. No connector stores state or makes decisions.

5. **UI is read-only for policy**: Admin UI renders state and accepts operational actions (approve, reject, dispatch). It does not define governance rules or create policy.

6. **Data, not meta-programming**: Chain templates are JSON arrays of steps with roles. No state machine DSL, no BPMN engine. A `for` loop over chain steps.

---

## 10. Assessment

PuddleJumper V1.0 delivers on the 90-day Architecture North Star roadmap. The approval chain pipeline, parallel approvals, PolicyProvider interface, admin UI, and observability stack are all shipped and tested. The system has a 0.76 test-to-source ratio with 447+ test cases.

The main risks are:
- **JWT secret fallback** (P0 security item — small fix, high impact)
- **PRR test coverage gap** (2 skipped test files, ~250 lines of untested route code)
- **No email delivery** for workspace invitations (acceptable for V1, needed for V1.1)

The architecture is sound. The PJ/VAULT boundary is clean. The governance engine is intentionally procedural. The system is ready for V1.1 work focused on operational hardening, test coverage completion, and the feature gaps listed above.
