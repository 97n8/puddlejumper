# PuddleJumper — Next Steps Proposal

> **Date:** February 17, 2026
> **Baseline:** V1.0.0 (released Feb 16, 2026)
> **Prerequisite reading:** [SYSTEMS-REVIEW.md](SYSTEMS-REVIEW.md), [ARCHITECTURE-NORTH-STAR.md](ARCHITECTURE-NORTH-STAR.md)

---

## V1.0 Closure (Complete)

- `main` is green with Node 20 and deterministic bootstrap flow.
- Bootstrap/auth stabilization is merged.
- Rehydration replacements are merged: #49, #50, #51, #52.
- Phase E minimal observability/playbook slice is merged: #54.
- Staging SQLite startup hardening is merged: #55.
- Tracking issues are closed: #48, #53, #20.
- 507+ tests passing. CI pipeline healthy.

---

## V1.1 Priorities

### Priority 1 — Security Hardening (Week 1)

| Item | Effort | Detail |
|------|--------|--------|
| 1.1 JWT production guard | Small | In `packages/core/src/jwt.ts`, throw an error when `NODE_ENV=production` and `JWT_SECRET` is not set, instead of falling back to `'dev-secret'`. This is the only P0 security item. |
| 1.2 Audit secret rotation docs | Small | Document the JWT_SECRET rotation procedure in `ops/runbooks/`. Include steps for rolling restart with old+new secret overlap. |

### Priority 2 — Test Coverage Completion (Weeks 1–2)

| Item | Effort | Detail |
|------|--------|--------|
| 2.1 Enable PRR store tests | Medium | Add `dbPath` parameter to `PrrStore` constructor following the `ApprovalStore`/`ChainStore` injection pattern. Write in-memory test suite for store operations (create, list, update status, close). |
| 2.2 Enable PRR API tests | Medium | Refactor PRR route handlers to accept injected store instance. Write API-level tests for `/api/prr` and `/api/prr/admin` endpoints. |
| 2.3 Access route tests | Small | Create `access.test.ts` covering request submission, status lookup, and close operations. |
| 2.4 PRR admin route tests | Medium | Create `prr-admin.test.ts` for the 255-line admin PRR management route. |

**Target:** Close the 2 skipped test files and add 3 new test files. Expected: ~530+ total tests.

### Priority 3 — Audit Log UI (Weeks 2–3)

| Item | Effort | Detail |
|------|--------|--------|
| 3.1 Audit events API | Small | Add `GET /api/admin/audit` endpoint that queries audit events from SQLite with pagination and filtering (by action type, user, time range). |
| 3.2 Admin UI audit tab | Medium | Add "Audit Log" tab to `/pj/admin` showing audit events in a table. Filter controls for event type and time range. CSP-compliant (external CSS/JS only, `data-action` event delegation). |
| 3.3 Chain-stuck alert | Small | Add alert rule for chain steps pending >24h. Runbook entry already exists at `ops/runbooks/chain-stuck.md`. |

### Priority 4 — Feature Gaps (Weeks 3–5)

| Item | Effort | Detail |
|------|--------|--------|
| 4.1 Email invitations | Medium | Integrate transactional email provider (e.g., Resend, SendGrid) for workspace invitation delivery. Currently copy-link only. |
| 4.2 Workspace ownership transfer | Small | `POST /api/workspace/transfer` endpoint + admin UI button. Requires current owner auth. |
| 4.3 Multi-workspace support | Large | Allow users to belong to multiple workspaces. Add workspace switcher to admin UI. Requires schema changes and session-per-workspace handling. |

### Priority 5 — Operational Maturity (Weeks 5–8)

| Item | Effort | Detail |
|------|--------|--------|
| 5.1 SharePoint dispatcher | Large | Wire Microsoft Graph API for document library uploads and list item management. Requires Azure AD app registration. |
| 5.2 Connector retry refactor | Small | Move retry configuration from route handlers to dispatcher registration (`registry.register(dispatcher, { retryPolicy })`). Already partially done. |
| 5.3 RemotePolicyProvider | Medium | HTTP-based `PolicyProvider` implementation that calls an external VAULT service. Swap for `LocalPolicyProvider` via config. Interface already defined and tested. |
| 5.4 Audit forwarding | Medium | `PolicyProvider.writeAuditEvent()` sends events to external VAULT audit ledger when `RemotePolicyProvider` is active. |

---

## Merge Gate Policy (Unchanged)

- **Backend-only changes** (`n8drive/**`, backend tests/docs): GitHub CI must pass.
- **UI/site surface changes** (`publiclogic-os-ui/**` or `publiclogic-site/**`): GitHub CI + relevant Vercel status must pass.
- All PRs are small, single-purpose, from current `main`.

## Operator Notes (Unchanged)

- Use Node 20 (`nvm use 20`) before ad-hoc test runs.
- If native module mismatch occurs, rerun `bash scripts/bootstrap.sh`.
- Keep `.pj-test-logs/` local-only for diagnostics.

---

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| JWT guard before features | Only P0 security item — small fix, high impact | Feb 17, 2026 |
| PRR tests before new features | 2 skipped test files represent ~250 lines of untested route code | Feb 17, 2026 |
| Audit UI before email | Operators need visibility into system behavior before adding new communication channels | Feb 17, 2026 |
| Multi-workspace last | Largest scope, lowest urgency — single workspace per user is acceptable for current scale | Feb 17, 2026 |
| SharePoint deferred to P5 | Stub works for registry pattern validation; no current customer need for Graph API dispatch | Feb 17, 2026 |
| RemotePolicyProvider deferred to P5 | LocalPolicyProvider is functionally complete; VAULT service build deferred until compliance-grade audit is needed | Feb 17, 2026 |
