# PuddleJumper — Full Systems Review

> **Date:** February 16, 2026
> **Scope:** Codebase, CI/CD, testing, deployment, security, and open work

---

## 1. Current State Summary

PuddleJumper V1.0.0 is live with 507 total tests (428 unit + E2E), deployed on
Fly.io, and backed by SQLite. The governance engine (1300+ lines, fail-closed)
is stable and should not be rewritten. Multi-tenant workspaces with RBAC
(Owner / Admin / Member / Viewer), tier management (Free / Pro), and approval
chain infrastructure are all functional.

| Area | Status |
|------|--------|
| Core governance engine | ✅ Stable, 1304 lines, fail-closed |
| Multi-tenant workspaces | ✅ Shipped in V1.0.0 |
| Approval chains (multi-step) | ✅ Data model & API present |
| CI pipeline (build, typecheck, test, contract check, Docker smoke) | ⚠️ Contract check was failing on `main` — fixed in this PR |
| Fly.io production deployment | ✅ Deploying on push to main |
| SQLite backup (every 6 hours) | ✅ Automated via `db-backup.yml` |
| Playbook sync (3-directory invariant) | ✅ In sync, CI-enforced |
| Observability (Prometheus metrics) | ✅ Counters, gauges, histograms |
| Security (JWT, CSRF, CSP, rate limiting) | ✅ Documented in SECURITY.md |
| Test count | 428 passing unit tests, 2 skipped |

---

## 2. CI / CD Health

### Pipelines

| Workflow | Trigger | Status |
|----------|---------|--------|
| `ci.yml` | push/PR to main | ⚠️ Was failing (PJ contract check) — fixed |
| `fly-deploy.yml` | push to main | ✅ Passing |
| `db-backup.yml` | Every 6h cron | ✅ Passing |
| `playbook-sync.yml` | PR touching playbooks | ✅ Passing |

### Issue fixed: PJ contract check failure

The file `puddlejumper-master-environment-control.html` was missing three
required elements enforced by `scripts/check-pj-contract.mjs`:

1. `const PJ_EXECUTE = "/api/pj/execute"` — authoritative execution route
2. `const ENABLE_BACKEND = true` — backend mode default
3. `<meta http-equiv="Content-Security-Policy">` — inline CSP with SHA-256
   hashes for the `<style>` and `<script>` blocks

This PR adds all three, and the contract check now passes.

---

## 3. Open Pull Requests

| PR | Title | Status | Notes |
|----|-------|--------|-------|
| #33 | Strip lockfile churn | Draft | Prerequisite for #34 |
| #34 | Chain template admin-only access | Draft | Depends on #33 |
| #32 | Async PolicyProvider | Draft | Depends on #33 |
| #38 | Governance engine PolicyProvider | Draft | Depends on #32 |
| #35 | stepId input validation | Draft | Independent |
| #40 | Observability + Logicville playbooks | Draft | Large scope |
| #42 | Playwright config + CI for OS UI | Open | Ready for review |

**Recommended merge order for backend PRs:** #33 → #34 → #32 → #38 → #35

---

## 4. Open Issues

| Issue | Title | Priority |
|-------|-------|----------|
| #20 | Staging Fly.io SQLite volume permissions | Post-V1 |

---

## 5. Architecture Observations

### Strengths

- **Clear separation of concerns.** VAULT (authority) vs PJ (control plane)
  vs connectors (execution) prevents single-point failures.
- **Fail-closed governance.** Default-deny with explicit approval is the
  correct model for municipal operations.
- **Comprehensive testing.** 428 unit tests with good coverage of approval
  lifecycle, dispatch, governance, OAuth, RBAC, and tier enforcement.
- **Contract enforcement.** `check-pj-contract.mjs` catches CSP, route, and
  configuration drift automatically.
- **Playbook sync.** Three-directory invariant with CI enforcement ensures
  content consistency across OS, UI, and marketing site.

### Areas to Watch

- **SQLite at scale.** Single-file databases work well for the current
  footprint, but will need monitoring as approval volume grows. The 6-hour
  backup cron is solid insurance.
- **Two skipped test files.** `prr.api.test.ts` and `prr.store.test.ts` are
  skipped. These should be re-enabled or removed if the feature has been
  deprecated.
- **Single TODO in codebase.** `n8drive/web/src/app/api/webhook/route.ts`
  has an unfinished idempotency implementation.
- **PR backlog.** Eight open draft PRs create merge-conflict risk. Merging
  the lockfile churn fix (#33) first will unblock the rest.

---

## 6. Suggested Next Steps

### Immediate (this week)

1. **Merge lockfile churn PR (#33).** Unblocks #34, #32, and #38.
2. **Merge chain template admin PR (#34).** Small, focused access control.
3. **Review and merge Playwright CI PR (#42).** Adds E2E smoke coverage for
   the OS UI tools page.

### Short-term (30 days, per North Star)

4. **Complete approval chain progression logic.** Sequential approval, rejection
   as terminal state, chain status API (`GET /api/approvals/:id/chain`).
5. **Re-enable or remove skipped PRR tests.** Eliminate test debt.
6. **Resolve staging deployment issue (#20).** SQLite volume permissions on
   Fly.io — low urgency but blocks staging environment.

### Medium-term (60 days, per North Star)

7. **Build Control Plane UI at `/pj/admin`.** Approval queue with chain
   progress visualization, operational dashboard.
8. **Add parallel approval support** to approval chains.
9. **Finish webhook idempotency** (the single TODO in the codebase).

### Longer-term (90 days, per North Star)

10. **Define PolicyProvider interface.** Local + remote variants, governance
    engine consumes policy without logic changes.
11. **Connector retry policy on registration.** SharePoint stub connector.
12. **Target 280+ tests** with full regression coverage.

---

## 7. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PR merge conflicts from 8 open drafts | High | Merge #33 first to unblock chain |
| Staging env unavailable (#20) | Medium | Production works; fix post-V1 |
| SQLite write contention under load | Low | WAL mode, 6-hour backups, monitor |
| CSP hash drift on HTML changes | Low | `check-pj-contract.mjs` catches it in CI |
