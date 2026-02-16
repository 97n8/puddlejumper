# PuddleJumper — Next Steps

> **Date:** February 16, 2026
> **Baseline:** V1.0.0 released, 520+ tests, CI green on main
> **Prerequisite reading:** [ARCHITECTURE-NORTH-STAR.md](ARCHITECTURE-NORTH-STAR.md), [SYSTEM-GUIDE.md](SYSTEM-GUIDE.md)

---

## Current State Summary

V1.0.0 shipped with multi-tenant workspace collaboration, approval chains (sequential + parallel), PolicyProvider abstraction, chain template CRUD, admin UI (5 tabs), and tier management. The 90-day Architecture North Star roadmap is complete.

**What works:**
- Governance engine (1300+ line fail-closed pipeline)
- Multi-step approval chains with chain progression
- Parallel approval support
- PolicyProvider interface (LocalPolicyProvider in production)
- Chain template CRUD API + admin UI
- Multi-provider OAuth (GitHub, Google, Microsoft)
- Workspace RBAC (Owner/Admin/Member/Viewer)
- Tier management (Free/Pro) with enforcement
- Prometheus metrics + Grafana dashboards
- CI pipeline (typecheck → contract check → tests → Docker smoke test)

**What's known-incomplete (documented in CHANGELOG):**
- Email invitations: copy-link only, no sending
- No audit log UI (events logged but not viewable)
- Single workspace per user
- No workspace ownership transfer
- No billing integration
- Slack dispatcher is a stub
- SharePoint dispatcher is a stub
- 2 PRR test files skipped (file-based SQLite not injectable for tests)

---

## Open Issue

| # | Title | Priority |
|---|-------|----------|
| [#20](https://github.com/97n8/puddlejumper/issues/20) | ops: fix staging Fly.io deployment (SQLite volume permissions) | Post-V1 |

---

## Open PRs (recommended merge order)

10 open PRs as of Feb 16, 2026. Several overlap or are superseded.

### Backend merge chain (sequential rebase)

| Order | PR | Title | Status | Notes |
|-------|-----|-------|--------|-------|
| 1 | [#33](https://github.com/97n8/puddlejumper/pull/33) | chore: strip lockfile churn from PRs #32 and #34 | Draft | Prerequisite — clean diffs for #34 and #32 |
| 2 | [#34](https://github.com/97n8/puddlejumper/pull/34) | Merge admin-only access enforcement for chain template endpoints | Draft | Chain template admin routes |
| 3 | [#32](https://github.com/97n8/puddlejumper/pull/32) | Make PolicyProvider async for RemotePolicyProvider (HTTP-to-VAULT) | Draft | Async PolicyProvider — enables future VAULT integration |
| 4 | [#38](https://github.com/97n8/puddlejumper/pull/38) | feat: governance engine consumes async PolicyProvider (Week 10) | Draft | Wire governance engine to async PolicyProvider |
| 5 | [#35](https://github.com/97n8/puddlejumper/pull/35) | Harden stepId input validation and document role matching contract | Draft | Security hardening |

### Other PRs

| PR | Title | Status | Recommendation |
|----|-------|--------|----------------|
| [#42](https://github.com/97n8/puddlejumper/pull/42) | Add Playwright config and CI workflows for OS UI smoke tests | Ready | Review and merge — standalone CI improvement |
| [#43](https://github.com/97n8/puddlejumper/pull/43) | fix: make admin panel CSP-compliant | Draft | Review — CSP compliance fix |
| [#44](https://github.com/97n8/puddlejumper/pull/44) | Fix Playwright locators, nullglob in sync script, add PR cleanup guide | Draft | Review — multiple small fixes |
| [#40](https://github.com/97n8/puddlejumper/pull/40) | feat(os): Logicville playbooks, governance card, observability metrics, CI safety nets | Draft | Large scope — consider splitting or closing if superseded |
| [#45](https://github.com/97n8/puddlejumper/pull/45) | Review repository and propose next steps | Draft | This PR |

**Recommended action:** Merge #33 → #34 → #32 → #38 → #35 in order (each rebased on the previous). Merge #42 independently. Evaluate #40, #43, #44 for overlap and close any that are fully superseded.

---

## Priority 1 — Security & Reliability (do first)

### 1.1 Harden JWT secret handling

**File:** `packages/core/src/jwt.ts:3` (existing code in repo)

The current implementation in that file falls back to a hardcoded secret if the env var is missing:

```typescript
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret');
```

**Risk:** If `JWT_SECRET` is unset in production, all JWTs are signed with `'dev-secret'` — any attacker who reads the source code can forge tokens.

**Proposed fix:** Fail loudly in production. Keep the dev fallback only when `NODE_ENV !== 'production'`:

```typescript
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return new TextEncoder().encode('dev-secret');
  }
  return new TextEncoder().encode(secret);
}
const SECRET = getJwtSecret();
```

**Effort:** 15 minutes. **Impact:** Prevents token forgery in production.

### 1.2 Fix staging deployment (Issue #20)

SQLite volume permissions on Fly.io prevent staging from starting. Production works because the volume was provisioned correctly.

**Fix:** Ensure the Dockerfile creates the data directory with correct ownership before the volume mount point:
```dockerfile
RUN mkdir -p /data && chown node:node /data
```

Alternatively, configure the Fly.io volume mount with the correct UID/GID.

**Effort:** 1-2 hours including testing. **Impact:** Unblocks staging for all future work.

### 1.3 Merge stepId validation (PR #35)

Input validation hardening for approval chain step IDs. This is a security boundary — untrusted input reaching the approval pipeline without validation could cause unexpected behavior.

**Effort:** Review and merge. **Impact:** Defense-in-depth for approval operations.

---

## Priority 2 — PR Hygiene (do before new feature work)

### 2.1 Merge the backend PR chain

PRs #33 → #34 → #32 → #38 → #35 represent completed work from the 90-day cycle. Each PR has been reviewed but is still in draft. Merging this chain clears the backlog and establishes the async PolicyProvider as the production baseline.

**Process:**
1. Merge #33 (lockfile cleanup)
2. Rebase #34 on main, resolve conflicts, merge
3. Rebase #32 on main, resolve conflicts, merge
4. Rebase #38 on main, resolve conflicts, merge
5. Rebase #35 on main, resolve conflicts, merge

**Effort:** 2-4 hours. **Impact:** Reduces open PR count from 10 to 5.

### 2.2 Close superseded PRs

Evaluate PRs #40 and #43 for overlap with already-merged work. If their changes are fully covered by other PRs or main, close them with a comment explaining which PR supersedes them.

### 2.3 Merge Playwright CI (#42)

PR #42 adds Playwright config and CI workflows for OS UI smoke tests. It's independent of the backend chain and ready for review. Merging it improves CI coverage for the frontend.

---

## Priority 3 — Test Coverage Gaps (fix before V1.1 features)

### 3.1 Enable PRR test suites

**Files:** `apps/puddlejumper/test/prr.store.test.ts`, `apps/puddlejumper/test/prr.api.test.ts`

Both suites are `describe.skip()` because PRR routes use file-based SQLite without injectable database parameters.

**Proposed fix:** Refactor `prrStore.ts` to accept an optional database path or connection parameter. The pattern already exists in `ApprovalStore` and `ChainStore` — follow the same constructor injection approach. For example:

```typescript
// Current pattern (simplified):
export class PrrStore {
  constructor() {
    this.db = new Database('./data/prr.db');
  }
}

// Proposed pattern:
export class PrrStore {
  constructor(dbPath: string = './data/prr.db') {
    this.db = new Database(dbPath);
  }
}
```

Then update tests to use `:memory:` or a temp directory.

**Effort:** 2-4 hours. **Impact:** Recovers ~20+ tests of coverage for the PRR feature.

### 3.2 Implement Slack dispatcher (or document as intentionally deferred)

**File:** `apps/puddlejumper/src/engine/dispatchers/slack.ts`

Currently a stub that always returns `status: "skipped"`. If Slack integration is planned for V1.1, implement it. If not, add a clear comment in the code and in CHANGELOG/docs that it's intentionally deferred, and ensure the stub doesn't silently swallow dispatch requests in production.

**Consideration:** If a governed action specifies `connector: "slack"`, the dispatch silently succeeds with `"skipped"` status. This could mislead operators into thinking a Slack notification was sent. Consider returning `status: "error"` with a message about the connector not being configured, or throwing an error, so operators know the action wasn't executed.

### 3.3 Add tests for uncovered modules

The following modules have limited or no test coverage:

| Module | Location | Current Coverage |
|--------|----------|-----------------|
| `authCallback.ts` | `apps/puddlejumper/src/api/routes/` | No dedicated tests |
| `capabilities.ts` | `apps/puddlejumper/src/api/routes/` | No dedicated tests |
| `rateLimit.ts` | `apps/puddlejumper/src/api/` | 7 tests (minimal) |
| `msGraph.ts` | `apps/puddlejumper/src/api/routes/` | No dedicated tests |

**Effort:** 1-2 days. **Impact:** Increases confidence for V1.1 changes.

---

## Priority 4 — V1.1 Features (the next value delivery)

Based on ARCHITECTURE-NORTH-STAR.md, CHANGELOG known limitations, and the current codebase state, these are the highest-value features for V1.1:

### 4.1 Audit log UI tab

**Why first:** Audit events are already logged in SQLite. The admin UI already has a tab system. This is the lowest-effort, highest-visibility feature — municipality admins need to see what happened without reading logs or querying the database.

**Implementation:**
1. Add an "Audit" tab to the admin UI (`admin.html` + `pj-admin.js`)
2. Create `GET /api/admin/audit` endpoint that queries the audit store with pagination
3. Render a time-ordered table: timestamp, actor, action, target, result
4. Add filter by action type and date range

**Effort:** 2-3 days. **Impact:** Closes the most-requested V1.0 gap.

### 4.2 Email invitation delivery

**Why:** Invitations currently require copy-pasting a link. For municipal workflows, the admin creates the invitation but the invitee never sees it unless the admin manually sends the URL.

**Implementation:**
1. Choose a transactional email provider (SendGrid, Postmark, or AWS SES)
2. Create an `EmailDispatcher` following the existing dispatcher pattern
3. Wire invitation creation to send an email with the acceptance link
4. Add a fallback: if email sending fails, the copy-link UI still works

**Effort:** 1-2 days (provider setup) + 1 day (integration). **Impact:** Makes workspace collaboration practical.

### 4.3 Chain stuck alert

**Why:** If an approval chain step is pending for >24 hours, the municipality admin has no way to know unless they check the dashboard. An alert ensures stuck chains are escalated.

**Implementation:**
1. Add a Prometheus gauge `approval_chain_step_pending_age_seconds` (already specified in ARCHITECTURE-NORTH-STAR.md appendix)
2. Add an AlertManager rule that fires when any chain step is pending >24h
3. Add a runbook entry in `ops/runbooks/approvals.md`

**Effort:** 1 day. **Impact:** Operational safety for multi-step approval workflows.

### 4.4 Multi-workspace support

**Why:** Current limitation is one workspace per user. Municipal operators may need to manage multiple departments as separate workspaces.

**Implementation:**
1. Remove the single-workspace constraint in user creation
2. Add workspace switching UI
3. Ensure all API endpoints continue to scope data by workspace ID

**Effort:** 2-3 days. **Impact:** Unblocks multi-department municipalities.

---

## Priority 5 — Code Quality (ongoing)

### 5.1 Reduce `as any` type casts

11 instances across the codebase, concentrated in `chainStore.ts` (5). These defeat TypeScript's type safety guarantees.

**Fix:** Define typed row interfaces for SQLite query results:

```typescript
interface ChainRow {
  id: string;
  approvalId: string;
  templateId: string;
  status: string;
  createdAt: string;
}

// Replace: const row = stmt.get(id) as any;
// With:    const row = stmt.get(id) as ChainRow | undefined;
```

**Effort:** 1-2 hours. **Impact:** Better refactoring safety and IDE support.

### 5.2 Centralize environment variable validation

Environment variables are accessed via `process.env.*` in 30+ locations. The server startup validates some (`JWT_SECRET`, `CONNECTOR_STATE_SECRET`) but not all.

**Fix:** Create a single `src/config/env.ts` that validates all required variables at startup and exports typed accessors. The pattern already partially exists in `startupConfig.ts` — extend it:

```typescript
export const env = {
  jwtSecret: requireEnv('JWT_SECRET'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3002', 10),
  // ... all env vars
} as const;
```

**Effort:** 2-3 hours. **Impact:** Fail-fast on misconfiguration, single source of truth.

### 5.3 Improve Slack dispatcher stub behavior

The Slack dispatcher silently returns `"skipped"` for all dispatch requests. This is dangerous in production — an operator might configure a governed action to notify via Slack and never realize the notification isn't being sent.

**Options:**
1. Return `status: "error"` instead of `"skipped"` so the dispatch is marked as failed
2. Add a startup warning log when SlackDispatcher is registered: `"SlackDispatcher is a stub — Slack actions will not be delivered"`
3. Check for a `SLACK_BOT_TOKEN` env var and only register the dispatcher if it's present

---

## Priority 6 — Infrastructure & Operations

### 6.1 Fix staging deployment (Issue #20)

Same as Priority 1.2. Listed again because it blocks staging validation of all future changes.

### 6.2 RemotePolicyProvider

Once the async PolicyProvider lands (PRs #32 + #38), the next step is a `RemotePolicyProvider` that calls an external VAULT service over HTTP. This is the foundation for multi-municipality compliance separation.

**Implementation:**
1. Define the HTTP contract: `GET /policy/chain-template?action=X&municipality=Y`
2. Implement `RemotePolicyProvider` as an HTTP client wrapping the PolicyProvider interface
3. Add circuit breaker / timeout to prevent VAULT outages from blocking PJ

**Effort:** 2-3 days. **Impact:** Prepares PJ for VAULT integration without architectural changes.

### 6.3 SharePoint dispatcher

Currently a stub similar to Slack. Needed for municipalities that use SharePoint as their document substrate.

**Implementation:** Implement using Microsoft Graph API for SharePoint operations (file upload, list item creation, page publishing). Follow the same pattern as `GitHubDispatcher`.

**Effort:** 3-5 days. **Impact:** Expands PJ to the M365 ecosystem.

---

## Recommended 30-Day Sprint

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Security + PR hygiene | Fix JWT secret fallback, merge #33→#34→#32→#38→#35, close superseded PRs |
| 2 | Test recovery + staging | Enable PRR test suites, fix staging deployment (#20), merge Playwright CI (#42) |
| 3 | Audit log UI | Add Audit tab to admin UI + `GET /api/admin/audit` endpoint |
| 4 | Chain stuck alert + docs | AlertManager rule for stuck chains, update SYSTEM-GUIDE.md, tag V1.1.0 |

**Target:** 540+ tests, 0 open security items, staging deployment working, audit log visible to admins.

---

## What NOT to Start Yet

| Item | Why not now |
|------|------------|
| Billing integration (Stripe) | No paying customers yet. Manual tier changes work. |
| VAULT service | Interface is defined. Build the service when a customer needs compliance-grade audit separation. |
| Rule engine extraction | Procedural pipeline works. Revisit at 3+ municipalities with divergent rules. |
| Connector marketplace | Only 2 active dispatchers. Registration is a function call. |
| Multi-region deployment | Single Fly.io machine handles current load. |
| Mobile UI | Municipal admins use desktop browsers. |
