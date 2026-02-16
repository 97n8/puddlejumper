# PuddleJumper — Next Phase (V1.1)

> **Date:** February 16, 2026
> **Status:** Proposed
> **Prerequisite:** [SYSTEMS-REVIEW.md](SYSTEMS-REVIEW.md), [ARCHITECTURE-NORTH-STAR.md](ARCHITECTURE-NORTH-STAR.md)

---

## Context

The 90-day North Star roadmap is complete. Multi-step approval chains,
parallel approvals, the PolicyProvider interface, chain template CRUD, and
the Control Plane admin UI are all implemented with 520+ tests. V1.0.0 is
live on Fly.io.

This document proposes the next phase of work: **V1.1**, focused on
closing operational gaps, landing the open PR backlog, and extending the
platform toward its first multi-municipality deployment.

---

## Phase 0: Hygiene (Week 1)

Clear the PR backlog before adding new work. All PRs below are draft and
awaiting merge.

| # | Task | Effort |
|---|------|--------|
| 1 | Merge PR #33 (lockfile churn) | Review + merge |
| 2 | Merge PR #34 (chain template admin access) | Rebase on #33, merge |
| 3 | Merge PR #32 (async PolicyProvider) | Rebase on #33, merge |
| 4 | Merge PR #38 (governance engine PolicyProvider) | Rebase on #32, merge |
| 5 | Merge PR #35 (stepId validation) | Independent, merge |
| 6 | Merge PR #42 (Playwright CI for OS UI) | Review, merge |
| 7 | Close PR #40 (superseded by merged work) | Close |
| 8 | Close PR #43 (empty, superseded by this PR) | Close |
| 9 | Re-enable or remove skipped PRR tests | Half-day |
| 10 | Resolve webhook idempotency TODO | Half-day |

**Exit criterion:** CI green on main, zero open draft PRs, zero skipped
tests, zero TODOs.

---

## Phase 1: Operational Completeness (Weeks 2–4)

Close the gaps between "feature exists" and "feature is production-ready
for a municipality admin."

### 1.1 Audit Log UI Tab

The admin page has 5 tabs (Queue, Templates, Dashboard, PRR, Members) but
no audit event viewer. PolicyProvider already writes events to SQLite via
`writeAuditEvent()` and supports queries via `getAuditEvents()`.

| Deliverable | Detail |
|-------------|--------|
| Add "Audit" tab to admin UI | Table: timestamp, actor, action, outcome, correlationId |
| Filterable by date range and action type | Server endpoint: `GET /api/admin/audit?since=&until=&action=` |
| Paginated (50 per page) | Use existing `countAuditEvents()` for total |

**Why now:** Municipality admins need to answer "who approved what, when?"
without SSH access. The backend exists; the UI doesn't.

### 1.2 Chain Step Stuck Alert

The North Star called for "alert for chain step stuck >24h" (Week 12).
The Prometheus metrics exist but this specific alert rule is missing.

| Deliverable | Detail |
|-------------|--------|
| Add Prometheus alert rule | `ChainStepStuck24h` — fires when any step has been `active` for >24 hours |
| Add to `ops/alerts/approval-alerts.yml` | Joins existing 6 alert rules |
| Add runbook entry | `ops/runbooks/approvals.md` — "Chain step stuck" section |

### 1.3 Staging Environment (Issue #20)

SQLite volume permissions fail on Fly.io staging. Production works because
the volume was provisioned correctly. Fix is likely a Fly.io volume
re-creation or entrypoint permission fix.

| Deliverable | Detail |
|-------------|--------|
| Diagnose and fix staging volume | SSH into staging, check `/data/` permissions |
| Add staging health check to CI | Optional: periodic `curl` to staging `/health` |

---

## Phase 2: Multi-Workspace & Invitations (Weeks 5–7)

V1.0.0 known issues include: single workspace per user, no email
invitations, no workspace ownership transfer. These block multi-
municipality deployment.

### 2.1 Multi-Workspace Support

Currently a user belongs to one workspace. Municipal employees may serve
on multiple boards or committees, each with its own approval chains.

| Deliverable | Detail |
|-------------|--------|
| Allow user → many workspaces | Schema change: workspace_members junction table (already exists, need to lift the UI constraint) |
| Workspace switcher in admin UI | Dropdown or sidebar showing user's workspaces |
| Scope all API queries to active workspace | Already workspace-scoped; add `X-Workspace-Id` header or query param |

### 2.2 Email Invitations

Invitations are created and auto-accepted on login, but no email is sent.
Admins must copy-paste invite links manually.

| Deliverable | Detail |
|-------------|--------|
| Integrate transactional email | SendGrid, Postmark, or SES — single "you've been invited" template |
| Send email on `POST /api/workspace/invite` | Include accept link with token |
| Add `EMAIL_API_KEY` to env | Document in LAUNCH_CHECKLIST.md |

**Why now:** Without email, invitations require out-of-band coordination.
For a municipality onboarding 10+ employees, this is a blocker.

### 2.3 Workspace Ownership Transfer

Currently no mechanism to transfer workspace ownership. If the original
creator leaves, the workspace is stuck.

| Deliverable | Detail |
|-------------|--------|
| `POST /api/workspace/transfer` | Owner-only, transfers to existing admin member |
| Audit event on transfer | PolicyProvider records the event |

---

## Phase 3: Connector Expansion (Weeks 8–10)

Two real dispatchers (GitHub, Webhook) and one chat dispatcher (Slack)
serve the pilot. A second municipality will likely need SharePoint and
possibly Microsoft Teams.

### 3.1 SharePoint Dispatcher

The stub exists (`dispatchers/sharepoint.ts`). Needs Azure AD app
registration and Microsoft Graph API integration.

| Deliverable | Detail |
|-------------|--------|
| Implement `SharePointDispatcher` | Upload documents, create list items via Graph API |
| Azure AD app registration docs | Add to LAUNCH_CHECKLIST.md |
| Tests | Mock Graph API responses, test retry on 429/503 |

### 3.2 Connector Retry Policy on Registration

The North Star (Week 11) called for moving retry config from route
handlers to dispatcher registration:
`registry.register(dispatcher, { retryPolicy })`.

| Deliverable | Detail |
|-------------|--------|
| Refactor retry policy to registration | Each dispatcher declares its retry params on register |
| Default policy for all dispatchers | `maxAttempts: 3, baseDelayMs: 1000, retryOn: [502, 503, 504]` |
| Override per dispatcher | SharePoint may need longer backoff for throttling |

---

## Phase 4: VAULT Preparation (Weeks 11–12)

The PolicyProvider interface is defined. `LocalPolicyProvider` works.
The next step is making PJ ready to consume a remote VAULT service when
one exists.

### 4.1 RemotePolicyProvider

PR #32 already makes the interface async. The next step is a concrete
`RemotePolicyProvider` that makes HTTP calls to a VAULT API.

| Deliverable | Detail |
|-------------|--------|
| `RemotePolicyProvider` class | HTTP client calling VAULT endpoints |
| Configuration: `VAULT_URL`, `VAULT_API_KEY` | Feature-flagged: falls back to local if not set |
| Circuit breaker | If VAULT is unreachable, fall back to local (fail-closed means "deny if uncertain") |
| Tests | Mock HTTP responses, test fallback, test timeout |

### 4.2 Audit Event Forwarding

Currently audit events live only in PJ's SQLite. VAULT should hold the
immutable compliance-grade ledger.

| Deliverable | Detail |
|-------------|--------|
| Forward audit events to VAULT | `writeAuditEvent()` writes to local AND forwards to VAULT |
| Async forwarding with retry | Don't block the approval flow on VAULT availability |
| Local-first guarantee | If forwarding fails, event is still in local SQLite |

---

## What This Phase Does NOT Include

Consistent with the North Star "Not Doing" list:

| Item | Reason |
|------|--------|
| Rule engine / Policy DSL | Procedural pipeline works. No divergent rule sets yet. |
| Connector marketplace | 4 dispatchers total. Registration is a function call. |
| Event-driven automation | Events submit governed actions. No bypass. |
| Message queue / async dispatch | Synchronous dispatch + retry is deterministic. |
| Multi-region deployment | Single Fly.io machine. Add regions on demand. |
| Mobile UI | Desktop admin surface. Municipal admins use desktops. |
| Database migration off SQLite | WAL mode handles current scale. |

---

## Success Criteria for V1.1

| Metric | Target |
|--------|--------|
| Test count | 560+ (currently 520) |
| Open draft PRs | 0 |
| Skipped tests | 0 |
| TODOs in codebase | 0 |
| Dispatchers active | 4 (GitHub, Webhook, Slack, SharePoint) |
| Admin UI tabs | 6 (add Audit) |
| Multi-workspace | Users can belong to 2+ workspaces |
| Email invitations | Sent automatically on invite |
| Staging environment | Green, CI-monitored |

---

## Timeline Summary

| Week | Phase | Focus |
|------|-------|-------|
| 1 | 0 | PR backlog, test hygiene, TODO cleanup |
| 2–4 | 1 | Audit log UI, chain stuck alert, staging fix |
| 5–7 | 2 | Multi-workspace, email invitations, ownership transfer |
| 8–10 | 3 | SharePoint dispatcher, connector retry refactor |
| 11–12 | 4 | RemotePolicyProvider, audit forwarding |
