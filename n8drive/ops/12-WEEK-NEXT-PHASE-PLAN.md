# PuddleJumper — 12-Week Next Phase Plan

> **Date:** 2026-02-17
> **Authors:** Nate (Founder/Systems Architect), Allie (Dr. Allison Rothschild, Partner)
> **Status:** Ready for execution
> **Baseline:** V1.0.0 shipped 2026-02-16

---

## Executive Summary

**Objective (one sentence):**
Prepare PuddleJumper for a repeatable, compliant Logicville municipal pilot by stabilizing core platform/auth, completing pilot product work (Logicville), and delivering operations playbooks and compliance sign-offs.

**Success criteria (3 bullets):**

- **Production platform stable:** End-to-end auth flows work in dev/staging/prod with tests green (auth callback + cookie behavior) and Fly.io staging smoke pass.
- **Logicville pilot ready:** Seeded agenda, SOPs, public artifacts, and WCAG/201-CMR compliance checklist completed.
- **Pilot operations and measurements in place:** Deployment runbooks, monitoring/dashboards, metrics/alerts, and handoff package for towns.

---

## Program Overview (12 Weeks)

| Phase | Weeks | Goal |
|-------|-------|------|
| **Readiness & Stabilize** | 1–4 | Fix critical auth bugs, infra hardening, core tests & security baseline, developer experience for local/staging. |
| **Live Tests & Pilot Launch** | 5–8 | Full staging pilot run with invited users, resolve issues, accessibility/PRR/OML checks, begin public artifacts. |
| **Refinement & Handoff** | 9–12 | Complete pilot feedback loop, finalize SOPs, legal signoffs, production hardening, and handoff materials. |

> **Owners shorthand:** **Nate** (Founder / Systems), **Allie** (Behavioral / Pilot Product), **Dev** (Backend dev), **Frontend** (UI), **Ops** (Infra/Deploy), **QA** (Tests & QA), **Product** (Product owner / pilot coordination), **Legal** (Counsel).

---

## Workstream A — Platform / Infrastructure

**Goal:** Harden deployments (Fly.io / Vercel), make staging production-like, and ensure identity/cookie behavior across envs.

### Tasks

| # | Task | Owner(s) | Week(s) | Acceptance Criteria | Priority | Effort | Dependencies |
|---|------|----------|---------|---------------------|----------|--------|--------------|
| P1 | **Patch cookie domain & header behavior** — fix hardcoded domain & stop overwriting Set-Cookie | Dev, review Nate | Week 1 | `createJwtCookie` omits `Domain` when `COOKIE_DOMAIN` is unset; includes `Domain` only when explicitly configured. `setJwtCookieOnResponse` appends instead of overwriting. Unit test `cookie.test.ts` covers both cases. ✅ **Done** (this PR). | High | S | — |
| P2 | **Unify cookie helper & API usage** — central cookie helper used by all flows | Dev, review Nate | Weeks 1–2 | All auth entry points (OAuth callback, `POST /api/login`, refresh) use unified cookie helper. No duplicated cookie-setting logic. | High | M | P1 |
| P3 | **Update `.env.sample` and docs for `COOKIE_DOMAIN`** | Dev, Ops, Nate | Week 1 | `.env.sample` leaves `COOKIE_DOMAIN` blank. README/ENV_REFERENCE updated. ✅ **Done** (this PR). | High | S | P1 |
| P4 | **Staging Fly.io smoke & deploy automation** | Ops, Dev | Weeks 1–3 | `./scripts/deploy-fly.sh` into staging succeeds. `/health` returns 200. OAuth login sets cookies on staging domain. `pj_refresh` cookie present after login. Script idempotent and documented. | High | M | P1 |
| P5 | **Vercel frontend staging deploy** | Ops, Nate | Weeks 1–2 | Vercel preview deploy with `BACKEND_URL` pointing to staging Fly.io. Login → redirect → session restore works. Root Directory confirmed as `n8drive/web`. | High | M | P4 |
| P6 | **Harden CORS and cookie policy for prod** | Ops, Dev | Weeks 2–3 | `CORS_ALLOWED_ORIGINS` validated, SameSite/secure behavior confirmed for prod, domain handling documented in `ENV_REFERENCE.md`. | Med | M | P1, P4 |
| P7 | **Automated backup verification** | Ops, Nate | Week 3 | `scripts/deploy-fly.sh` includes pre-deploy backup step. `db:validate-restore` passes on backup. Documented in `LAUNCH_CHECKLIST.md`. | High | M | P4 |
| P8 | **Secrets & keys rotation plan** | Ops, Nate | Weeks 3–4 | Documented secret rotation steps for OAuth client secrets, JWT signing keys on Fly.io. Filed as `ops/runbooks/jwt-rotation.md`. | Med | S | P4 |
| P9 | **Deploy rollback & continuity** | Ops | Weeks 3–4 | Runbook: rollback procedure, DB migrations backup. `LAUNCH_CHECKLIST.md` updated. | Med | S | P4 |
| P10 | **Grafana dashboard import** | Ops, Nate | Weeks 3–4 | Grafana dashboard JSON in `ops/grafana/` imported. Shows approval chain metrics, request latency, error rate. | Med | M | P4 |
| P11 | **Alert rules for production** | Ops, Nate | Week 4 | Alertmanager rules: health-down >2min, approval-step stuck >24h, error rate >5%, auth failure spike >10/5min. | Med | M | P10 |
| P12 | **Production deploy (Fly.io + Vercel)** | Ops, Nate | Week 5 | Production Fly.io app at `publiclogic-puddlejumper.fly.dev`. Vercel at `pj.publiclogic.org`. `COOKIE_DOMAIN=.publiclogic.org` set in production env. OAuth end-to-end verified. | High | M | P4, P5, P7 |

> **Note:** P1, P2, P3 are the **auth mandate** and must be completed Weeks 1–2.

### Files to edit (auth fixes)

| Fix | Files | Tests to add/update |
|-----|-------|---------------------|
| Cookie domain | `n8drive/packages/core/src/cookie.ts` | `n8drive/packages/core/test/cookie.test.ts` (9 tests added) |
| Set-Cookie overwrite | `n8drive/packages/core/src/cookie.ts` | `n8drive/packages/core/test/cookie.test.ts` (append test) |
| `.env.sample` default | `n8drive/.env.sample` | — (config, not code) |
| `authCallback.ts` test coverage | `n8drive/apps/puddlejumper/src/api/authCallback.ts` | New: `n8drive/apps/puddlejumper/test/authCallback.test.ts` |

### Key Deliverables

- `n8drive/packages/core/src/cookie.ts` — fixed cookie helper
- `n8drive/packages/core/test/cookie.test.ts` — cookie unit tests
- `n8drive/.env.sample` — corrected defaults
- Staging deploy verified with cookie smoke test
- Production deploy with backup/restore validation

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OAuth provider credentials not configured for staging | Use GitHub OAuth (simplest) as first provider; defer Google/Microsoft to Week 3. |
| Fly.io volume mount failure on deploy | Pre-verify with `fly volumes list`; keep `sanity-test.sh` in CI. |
| Vercel Root Directory misconfigured | Confirm `n8drive/web` in Vercel dashboard (Settings → General). |

---

## Workstream B — Codebase & QA

**Goal:** Ensure auth correctness, tests and CI, QA coverage for key flows. All auth flows tested, unified cookie helper, test coverage above 500, CI green on every merge.

### Tasks

| # | Task | Owner(s) | Week(s) | Acceptance Criteria | Priority | Effort | Dependencies |
|---|------|----------|---------|---------------------|----------|--------|--------------|
| C1 | **Add `authCallback` integration test** — cover provider callback cookie behavior | QA, Dev | Weeks 1–2 | New tests: `test/auth-callback.test.ts` verifying cookies (`jwt` set with correct domain), redirect to `PJ_UI_URL`, error paths (missing token → 400, Logic Commons down → 502/500, no token returned → 502), dev-token endpoint toggle. ✅ **Done** (this PR, 11 tests). | High | M | P1 |
| C2 | **Unit tests for cookie helpers** | QA, Dev | Weeks 1–2 | `packages/core/test/cookie.test.ts` verifies domain handling, sameSite, secure flag, and Set-Cookie append behavior. ✅ **Done** (this PR, 9 tests). | High | S | — |
| C3 | **Unify cookie helper usage across login endpoints** (see Platform P2) | Dev | Weeks 1–2 | All login paths pass unit/integration tests. `authCallback.ts` and `routes/auth.ts` use consistent cookie attributes with `session.ts`. | High | M | C1, C2 |
| C4 | **Add E2E smoke test for auth refresh flow** | QA | Weeks 2–3 | `pjFetch` flow: get 401 → calls `/api/refresh` → retries and succeeds. Deterministic mocks for CI. | High | M | C1 |
| C5 | **Auth-smoke operational runbook** | Dev, Nate | Week 2 | New `ops/runbooks/auth-smoke.md` with: local dev cookie check, staging OAuth flow, prod session restore, refresh cycle verification. Follows existing runbook format. | High | S | — |
| C6 | **CI pipeline add staging smoke** | QA, Dev, Ops | Weeks 2–3 | GitHub Actions workflow to deploy to staging and run smoke e2e tests. Timeouts and retries configured. | Med | M | P4 |
| C7 | **Review and expand auth tests for edge cases** (missing refresh cookie, expired JWT, missing provider token) | QA, Dev | Weeks 3–4 | Tests added for error paths in `test/`. Coverage for expired JWT, missing refresh cookie, concurrent refresh dedup. | Med | M | C1 |
| C8 | **Test coverage dashboard & flakiness fixes** | QA | Weeks 3–4 | Coverage report artifact in CI. Flaky tests identified and remediation tickets created. | Med | M | CI |
| C9 | **Audit log viewer API** | Dev, Nate | Weeks 3–5 | `GET /api/audit` — paginated, filterable by workspace/action/date/actor. Workspace isolation enforced. Tests for pagination, filtering, isolation. (V1.1 Priority 1) | High | L | — |
| C10 | **Audit log viewer UI** | Frontend, Nate | Weeks 5–6 | Admin UI tab/page rendering audit trail with search and time filters. Read-only. Accessible (WCAG 2.1 AA keyboard nav). | High | L | C9 |
| C11 | **Webhook idempotency (SQLite)** | Dev | Weeks 5–6 | Processed event IDs stored in SQLite with TTL. Duplicate delivery returns 200 without re-processing. Tests for dedup, TTL expiry, unknown event ack. (V1.1 Priority 2) | Med | M | — |
| C12 | **Slack notification dispatcher** | Dev | Weeks 7–8 | `SlackDispatcher` sends approval-pending and approval-decided to configured webhook URL. Retry on 5xx. Tests for formatting, retry, channel routing. (V1.1 Priority 3) | Med | M | — |
| C13 | **Approval export (CSV/JSON)** | Dev | Weeks 9–10 | `GET /api/approvals/export?format=csv|json` — workspace-scoped, date-range filtered, includes chain step detail. Streamed response. Tests. (V1.1 Priority 4) | Med | M | — |
| C14 | **Email delivery for invitations** | Dev | Weeks 10–11 | Integrate transactional email (SendGrid/Postmark). Invitation emails sent with accept-link. Graceful fallback. (V1.1 Priority 5) | Med | M | — |
| C15 | **V1.1 release & CHANGELOG** | Dev, Product | Week 12 | `CHANGELOG.md` updated. Tag `v1.1.0`. All new tests green. Total test count ≥ 520. | High | S | C9–C14 |

### Exact files to edit for auth tasks

| Fix | Files | Tests |
|-----|-------|-------|
| Cookie domain + append | `n8drive/packages/core/src/cookie.ts` | `n8drive/packages/core/test/cookie.test.ts` (9 tests) ✅ |
| authCallback coverage | `n8drive/apps/puddlejumper/src/api/authCallback.ts` | `n8drive/apps/puddlejumper/test/auth-callback.test.ts` (11 tests) ✅ |
| Unify cookie helper | `n8drive/apps/puddlejumper/src/api/routes/auth.ts`, `n8drive/apps/puddlejumper/src/api/authCallback.ts` | Existing tests verify consistency |
| Session cookie alignment | `n8drive/apps/logic-commons/src/lib/session.ts` | Confirm cookie semantics align |
| `.env.sample` default | `n8drive/.env.sample` | — (config) ✅ |

### Key Deliverables

- `n8drive/apps/puddlejumper/test/authCallback.test.ts` — integration tests
- `n8drive/ops/runbooks/auth-smoke.md` — auth verification runbook
- Audit log API + UI (Priority 1)
- Webhook idempotency (Priority 2)
- Slack dispatcher (Priority 3)
- Approval export (Priority 4)
- Email invitations (Priority 5)

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Audit log UI scope creep (filters, search, graphs) | Start with table + date range only; add search in Week 6. |
| Email provider API key management | Use env-var for API key; document in `ENV_REFERENCE.md`; never commit. |
| Slack webhook URL exposure | Store per-workspace in encrypted column or env-var; document in `SECURITY.md`. |

---

## Workstream C — Logicville Product & Compliance

**Goal:** Logicville pilot running on PuddleJumper with seed agenda, compliance flags active, and first public artifacts published.

### Tasks

| # | Task | Owner(s) | Week(s) | Acceptance Criteria | Priority | Effort | Dependencies |
|---|------|----------|---------|---------------------|----------|--------|--------------|
| C-1 | **Review and update seed agenda items** | Product (Allie), Dev (Nate) | 1–2 | All 12 seed items in `logicvilleAgendaStore.ts` reviewed: due dates updated, statuses current, 2 new actions added for pilot (platform deploy, board packet). `LOGICVILLE_SEED_ITEMS` reflects current state. | High | S | — |
| C-2 | **Bootstrap Logicville workspace on staging** | Ops (Nate), Product (Allie) | 2 | Workspace created via OAuth login. Seed agenda imported. Internal + Public views verified in OS UI. | High | S | A-4, C-1 |
| C-3 | **Draft board packet insert template** | Product (Allie) | 2–3 | One-page template with: 3 bullets (what, why, ask), 1 visual suggestion slot, 1-sentence formal ask. WCAG 2.1 AA compliant. Filed as `publiclogic-operating-system/templates/board-packet-insert.md`. | High | S | — |
| C-4 | **Draft Staff FAQ (6 Qs)** | Product (Allie) | 3 | Plain-language answers covering: What is PuddleJumper? What changes for me? Is my data safe? How do I log in? Who do I contact? What is Logicville? WCAG checked. (Seed item A-104) | High | S | — |
| C-5 | **Universal SOP template + 2 examples** | Product (Allie), Dev (Nate) | 3–4 | Template approved. Two filled examples (one for PRR intake, one for approval workflow). Filed in `publiclogic-operating-system/templates/`. (Seed item A-105) | High | M | — |
| C-6 | **OML/PRR flag demo route** | Dev (Nate) | 4 | PRR intake (`POST /api/prr/intake`) creates record with `prr: true`. Public tracking endpoint (`GET /api/public/prrs/:publicId`) returns public-safe payload. Demo documented in auth-smoke runbook. | Med | M | A-4 |
| C-7 | **ARCHIEVE™ retention tag demo** | Dev (Nate) | 5–6 | Decision log entries with `retentionTag` field are stored and queryable. High-level retention routing documented (no proprietary mechanics exposed). | Med | S | C-6 |
| C-8 | **First public one-pager** | Product (Allie) | 4–5 | Published public-safe summary of Logicville pilot: what it is, who benefits, how to learn more. WCAG 2.1 AA. Filed in `publiclogic-operating-system/artifacts/`. | High | S | C-3 |
| C-9 | **Weekly founders cadence live** | Product (Allie), Dev (Nate) | 5+ | Weekly 30–45 min sync using agenda template from `09-logicville-living-agenda.md`. Rolling meeting notes captured in workspace. | High | S | C-2 |

### Key Deliverables

- Updated `logicvilleAgendaStore.ts` seed items
- Board packet insert template
- Staff FAQ document
- SOP template + 2 examples
- First public one-pager
- Live weekly cadence

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Holiday/meeting-cycle compression (Risk R-201) | Pre-schedule blocks; use async scripts; keep scope tight. |
| Seed items stale by pilot launch | Review seed items at Week 4 checkpoint; update statuses. |
| Board packet tone mismatch | Allie reviews all public artifacts before publish; keep language plain. |

---

## Workstream D — Pilot Operations & Metrics

**Goal:** Logicville pilot measured with 6+ metrics, dashboards live, weekly reports shared.

### Tasks

| # | Task | Owner(s) | Week(s) | Acceptance Criteria | Priority | Effort | Dependencies |
|---|------|----------|---------|---------------------|----------|--------|--------------|
| D-1 | **Define pilot metrics (6–8)** | Product (Allie), Dev (Nate) | 2 | Metrics defined (see Metrics section below). Measurement method documented. | High | S | — |
| D-2 | **Metrics dashboard (Grafana or equivalent)** | Ops (Nate) | 3–4 | Dashboard showing all pilot metrics. Updated automatically from Prometheus. Accessible to both founders. | Med | M | A-7 |
| D-3 | **Weekly pilot status report template** | Product (Allie) | 3 | One-page template: metrics snapshot, decisions made, actions due, risks flagged. Filed in `publiclogic-operating-system/templates/`. | Med | S | D-1 |
| D-4 | **First pilot status report** | Product (Allie), Dev (Nate) | 5 | Report generated from live data. Shared with both founders. | Med | S | D-2, D-3 |
| D-5 | **Uptime monitoring setup** | Ops (Nate) | 3 | External uptime check on `/health` (UptimeRobot, Fly.io checks, or equivalent). Alert on downtime >2 min. | High | S | A-4 |
| D-6 | **Pilot retrospective** | Product (Allie), Dev (Nate) | 12 | Written retro: what worked, what didn't, what to change. Filed in `publiclogic-operating-system/`. | Med | S | — |

### Key Deliverables

- Pilot metrics definition document
- Grafana dashboard
- Weekly status report template
- Retrospective document

---

## Workstream E — Cross-Cutting: Security, Accessibility, Retention, Legal

**Goal:** Ensure compliance with 201 CMR 17.00, Mass Open Meeting/Records law & WCAG 2.1 AA.

### Tasks

| # | Task | Owner(s) | Week(s) | Acceptance Criteria | Priority | Effort | Dependencies |
|---|------|----------|---------|---------------------|----------|--------|--------------|
| S1 | **Threat model review (auth & cookies)** | Nate, Dev, Ops | Weeks 1–2 | Threat model updated; mitigations added for cookie stealing, CSRF, session fixation. One-page doc filed. | High | S | P1 |
| S2 | **201 CMR 17.00 data security checklist** | Dev (Nate), Product (Allie), Legal | Weeks 2–4 | Checklist completed against PuddleJumper: PII handling, encryption at rest & in transit, key rotation, access controls, audit logging. Sign-off recorded in `n8drive/docs/compliance/201cmr-checklist.md`. | High | M | — |
| S3 | **WCAG 2.1 AA audit (public artifacts)** | Product (Allie), Frontend, QA | Weeks 6–7 | All public-facing artifacts (board packet, FAQ, one-pager, OS UI) audited with axe-core or equivalent. >90% pass or remediation tickets filed. | High | M | C-3, C-4, C-8 |
| S4 | **WCAG 2.1 AA audit (admin UI)** | Frontend (Nate), QA | Weeks 7–8 | Admin UI pages audited for keyboard navigation, color contrast, screen reader compatibility. Issues logged. Critical issues fixed before pilot end. | Med | M | C10 |
| S5 | **OML compliance review** | Product (Allie), Legal | Week 4 | Review agenda/meeting features against M.G.L. c.30A requirements: agenda posting, notice, minutes, recordings. Document gaps and plan. | High | S | — |
| S6 | **PRR readiness demo** | Dev (Nate), Product (Allie) | Week 5 | Demo PRR intake → status tracking → public response flow. Verify retention tags applied. Document in auth-smoke runbook. | High | S | C-6 |
| S7 | **Data ownership & continuity doc** | Product (Allie), Nate | Weeks 8–9 | Document confirming town owns all data. Backup/export procedures. Handoff steps if vendor relationship ends. Town can export all data at any time. | High | M | — |
| S8 | **Security scan (CodeQL + dependency audit)** | Dev (Nate), Ops | Weeks 4, 8, 12 | CodeQL scan green. `pnpm audit` with no high/critical vulnerabilities. Run at 3 checkpoints. | High | S | — |
| S9 | **Retention and ARCHIEVE integration** | Nate, Dev | Weeks 5–9 | Retention policies implemented at high level & demo. Decision log entries with `retentionTag` stored and queryable. No proprietary mechanics exposed. | Med | M | S6 |

### Sign-off Record

Record all sign-offs in `n8drive/ops/COMPLIANCE_SIGNOFF.md` with reviewer, date, and notes:

| Check | Standard | Signoff by | Target Week |
|-------|----------|------------|-------------|
| Cookie domain fix verified | Auth review finding | Dev + QA | Week 1 ✅ |
| Set-Cookie append verified | Auth review finding | Dev + QA | Week 1 ✅ |
| authCallback integration test green | Auth review finding | QA | Week 1 ✅ |
| Threat model reviewed | Security baseline | Nate + Dev | Week 2 |
| OAuth end-to-end on staging | Auth review finding | Ops | Week 2 |
| 201 CMR 17.00 checklist | MA data security | Nate + Legal | Week 4 |
| JWT secret is not `dev-secret` in prod | SECURITY.md | Ops | Week 4 |
| OML compliance review | M.G.L. c.30A | Allie + Legal | Week 4 |
| PRR demo route works | M.G.L. c.66 §10 | Nate + Allie | Week 5 |
| WCAG 2.1 AA audit (public artifacts) | WCAG 2.1 AA | Frontend + QA | Week 7 |
| WCAG 2.1 AA audit (admin UI) | WCAG 2.1 AA | Frontend + QA | Week 8 |
| Data ownership doc signed | Town data ownership | Allie + Nate | Week 9 |
| CodeQL scan green (3 checkpoints) | Security best practice | Dev | Weeks 4/8/12 |
| `pnpm audit` no high/critical vulns | Dependency security | Dev | Weeks 4/8/12 |

### Key Deliverables

- 201 CMR 17.00 checklist (signed off)
- WCAG 2.1 AA audit reports
- Data ownership & continuity document
- JWT rotation runbook
- Security scan results (3 checkpoints)

---

## Seed Items / Agenda Integration

### Current Seed Entries (from `logicvilleAgendaStore.ts`)

| ID | Kind | Title | Owner | Status | Pilot Update Needed |
|----|------|-------|-------|--------|---------------------|
| A-101 | Action | Draft VAULT high-level map | Nate | In Progress | Update due date to current sprint; status to reflect progress. |
| A-102 | Action | PublicInsight categories + scoring v0.9 | Allie | In Progress | Update due date; add DoD completion notes. |
| A-103 | Action | Board packet insert outline | Nate | Not Started | Map to task C-3. Update due date to Week 3. |
| A-104 | Action | Staff FAQ (6 Qs) | Allie | Not Started | Map to task C-4. Update due date to Week 3. |
| A-105 | Action | Universal SOP template + 2 examples | Both | Not Started | Map to task C-5. Update due date to Week 4. |
| D-101 | Decision | Day One narrative | Nate | Decided | No update needed. Keep as baseline decision. |
| D-102 | Decision | Founders agenda default cadence | Allie | Decided | No update needed. |
| R-201 | Risk | Holiday/meeting-cycle compression | Allie | Open | Review likelihood; update mitigation if schedule tightens. |
| R-202 | Risk | Vendor SSO slip | Nate | Open | **Critical.** Map to auth fix tasks A-1 through A-3. Update mitigation to reference cookie fix. |
| P-301 | Project | LogicvilleCONNECT expansion | Nate | Active | Update milestones to reference 12-week plan dates. |
| P-302 | Project | LogicvilleCLERK | Allie | Active | Update milestones. |
| P-303 | Project | LogicvilleFIX | Nate | Active | Update milestones. |

### New Seed Entries to Add

| ID | Kind | Title | Owner | Due | DoD |
|----|------|-------|-------|-----|-----|
| A-106 | Action | Platform auth fixes (cookie domain, Set-Cookie) | Nate | Week 1 | Cookie tests green, staging deploy verified. |
| A-107 | Action | Deploy PuddleJumper staging | Nate | Week 2 | `/health` 200, OAuth login works, cookies set. |
| A-108 | Action | First public one-pager (Logicville) | Allie | Week 5 | Published, WCAG checked, approved by both founders. |
| R-203 | Risk | Auth regression on production deploy | Nate | — | Mitigation: run auth-smoke runbook before and after deploy. |

### Bootstrap Process

1. **Week 1:** Allie and Nate review all 12 seed items in a 30-min session. Update due dates, statuses, and DoD to reflect current reality.
2. **Week 1:** Add the 4 new entries (A-106, A-107, A-108, R-203) to `LOGICVILLE_SEED_ITEMS` in `logicvilleAgendaStore.ts`.
3. **Week 2:** Import seed into staging workspace via OS UI Agenda page. Verify Internal and Public views.
4. **Week 5+:** Use the Agenda as the working system — add new items, update statuses, capture decisions during weekly syncs.

---

## Security, Accessibility & Legal Checklist

All checks recorded in `n8drive/ops/COMPLIANCE_SIGNOFF.md` with reviewer, date, and notes.
See Workstream E sign-off table for full details.

| Check | Standard | Target Week | Status |
|-------|----------|-------------|--------|
| Cookie domain fix verified | Auth review | Week 1 | ✅ Done |
| Set-Cookie append verified | Auth review | Week 1 | ✅ Done |
| authCallback integration test green | Auth review | Week 1 | ✅ Done (11 tests) |
| Threat model reviewed | Security baseline | Week 2 | ☐ |
| OAuth end-to-end on staging | Auth review | Week 2 | ☐ |
| 201 CMR 17.00 checklist | MA data security | Week 4 | ☐ |
| JWT secret is not `dev-secret` in prod | SECURITY.md | Week 4 | ☐ |
| OML compliance review | M.G.L. c.30A | Week 4 | ☐ |
| PRR demo route works | M.G.L. c.66 §10 | Week 5 | ☐ |
| WCAG 2.1 AA audit (public artifacts) | WCAG 2.1 AA | Week 7 | ☐ |
| WCAG 2.1 AA audit (admin UI) | WCAG 2.1 AA | Week 8 | ☐ |
| Data ownership doc signed | Town ownership | Week 9 | ☐ |
| CodeQL scan green (3 checkpoints) | Security | Weeks 4/8/12 | ☐ |
| `pnpm audit` no high/critical vulns | Dependencies | Weeks 4/8/12 | ☐ |
| Security smoke pre-launch | Pen test checklist | Weeks 4, 8 | ☐ |

---

## Metrics & Observability

### Pilot Metrics (8)

| # | Metric | Measurement | Target | Source |
|---|--------|-------------|--------|--------|
| 1 | **Uptime** | `/health` success rate over 7 days | ≥ 99.5% | UptimeRobot / Fly.io checks |
| 2 | **Mean time to resolve approval** | Avg time from approval-pending to decided | < 48 hours | `approval_chain_step_time_seconds` histogram |
| 3 | **Days-to-close PRR** | Avg time from PRR intake to closed | < 10 business days (MA statute) | PRR store queries |
| 4 | **Task completion rate** | % of agenda actions completed by due date | ≥ 70% | Agenda store status tracking |
| 5 | **Public artifact generation time** | Time from decision to published public summary | < 5 business days | Agenda store timestamps |
| 6 | **Accessibility pass rate** | % of WCAG 2.1 AA checks passing (axe-core) | ≥ 95% | axe-core audit results |
| 7 | **Auth success rate** | OAuth login success / total attempts | ≥ 98% | `auth.login` / `auth.login_failed` audit events |
| 8 | **Error rate (5xx)** | % of API requests returning 5xx | < 1% | Prometheus `http_requests_total` by status |

### Recommended Dashboards

| Dashboard | Panels | Source |
|-----------|--------|--------|
| **Platform Health** | Uptime, error rate, request latency p50/p95/p99, active sessions | Prometheus → Grafana |
| **Governance** | Pending approvals gauge, chain step times histogram, dispatch success rate | Prometheus → Grafana |
| **Pilot Progress** | Task completion rate, PRR days-to-close, public artifact count | Custom (Agenda store + PRR store) |

### Minimum Alert Rules

| Alert | Condition | Channel |
|-------|-----------|---------|
| `HealthDown` | `/health` fails for > 2 minutes | Slack / email |
| `ApprovalStepStuck` | Any approval chain step pending > 24 hours | Slack |
| `HighErrorRate` | 5xx rate > 5% for 5 minutes | Slack / email |
| `DiskUsageHigh` | Fly.io volume > 80% | Slack |
| `AuthFailureSpike` | > 10 `auth.login_failed` events in 5 minutes | Slack / email |

---

## Acceptance Criteria (Program Level)

### Platform

- [x] Auth tests green: cookie domain, Set-Cookie append, authCallback integration (20 tests added)
- [x] Cookie issues fixed and `.env.sample` updated
- [ ] Staging deployed and OAuth end-to-end verified
- [ ] Production deployed with `COOKIE_DOMAIN=.publiclogic.org`
- [ ] `/health` returns 200 on production with all 5 subsystems healthy
- [ ] Backup/restore validation completed within 24 hours of go-live
- [ ] Grafana dashboard live with approval chain and request metrics
- [ ] Alert rules firing correctly (test with synthetic failure)
- [ ] Threat model reviewed and mitigations documented

### Product

- [ ] Logicville workspace bootstrapped with current seed agenda
- [ ] Board packet insert template published (WCAG 2.1 AA)
- [ ] Staff FAQ published (6 questions, plain language)
- [ ] Universal SOP template + 2 examples published
- [ ] First public one-pager published
- [ ] Audit log viewer (API + UI) shipped and accessible to admins

### Pilot

- [ ] Weekly founders cadence running for ≥ 4 consecutive weeks
- [ ] ≥ 3 decisions captured in Decision Log with OML/PRR flags
- [ ] ≥ 1 PRR intake → close cycle completed
- [ ] Pilot retrospective written and filed

### Compliance

- [ ] 201 CMR 17.00 checklist signed off
- [ ] WCAG 2.1 AA audit completed for public artifacts (≥ 90% pass or remediation plan)
- [ ] OML compliance review documented
- [ ] Data ownership & continuity document signed
- [ ] No high/critical vulnerabilities in dependency audit
- [ ] CodeQL scan green at all 3 checkpoints
- [ ] Security smoke pre-launch report (Weeks 4, 8)

---

## Timeline & Owners (Week-by-Week)

### Week 1

- **Nate:** Patch `cookie.ts` (A-1, A-2). Remove `COOKIE_DOMAIN` default from `.env.sample` (A-3). Add `cookie.test.ts` unit tests. Start `authCallback.test.ts` integration test (B-1).
- **Allie:** Review 12 seed agenda items (C-1). Update due dates and statuses.
- **Both:** Kickoff call — confirm plan, assign lanes, lock first 14-day deliverables.

### Week 2

- **Nate:** Deploy to Fly.io staging (A-4). Vercel frontend staging deploy (A-5). Unify cookie helper (B-2). Finish `authCallback.test.ts` (B-1). Write auth-smoke runbook (B-3).
- **Allie:** Bootstrap Logicville workspace on staging (C-2). Start board packet insert template (C-3).
- **Both:** Define pilot metrics (D-1). Begin 201 CMR 17.00 checklist (E-1).

### Week 3

- **Nate:** Automated backup verification (A-6). Grafana dashboard import start (A-7). JWT rotation runbook (E-7). Uptime monitoring setup (D-5). Start audit log API (B-4).
- **Allie:** Staff FAQ draft (C-4). Finish board packet insert (C-3). SOP template start (C-5). Weekly status report template (D-3).
- **Both:** Finish 201 CMR 17.00 checklist (E-1).

### Week 4

- **Nate:** Finish Grafana dashboard (A-7). Alert rules (A-8). OML/PRR flag demo route (C-6). Continue audit log API (B-4). Security scan checkpoint 1 (E-8).
- **Allie:** OML compliance review (E-4). Finish SOP template + 2 examples (C-5). Seed item review checkpoint.
- **Both:** Review seed items status. Update `logicvilleAgendaStore.ts` if needed.

### Week 5

- **Nate:** Production deploy (A-9). Finish audit log API (B-4). Start audit log UI (B-5). Start webhook idempotency (B-6).
- **Allie:** First public one-pager (C-8). PRR readiness demo with Nate (E-5). First pilot status report (D-4).
- **Both:** Weekly cadence begins (C-9).

### Week 6

- **Nate:** Finish audit log UI (B-5). Finish webhook idempotency (B-6). ARCHIEVE retention tag demo (C-7).
- **Allie:** WCAG 2.1 AA audit start — public artifacts (E-2).

### Week 7

- **Nate:** Start Slack notification dispatcher (B-7).
- **Allie:** Finish WCAG audit — public artifacts (E-2). Log issues.

### Week 8

- **Nate:** Finish Slack dispatcher (B-7). WCAG audit — admin UI (E-3). Security scan checkpoint 2 (E-8).
- **Allie:** Data ownership & continuity doc start (E-6).

### Week 9

- **Nate:** Start approval export CSV/JSON (B-8).
- **Allie:** Finish data ownership doc (E-6).

### Week 10

- **Nate:** Finish approval export (B-8). Start email delivery for invitations (B-9).

### Week 11

- **Nate:** Finish email delivery (B-9). Final regression testing.
- **Allie:** Review all public artifacts for freshness.

### Week 12

- **Nate:** V1.1 release + CHANGELOG (B-10). Security scan checkpoint 3 (E-8).
- **Both:** Pilot retrospective (D-6). Update `NEXT-STEPS.md`. Tag `v1.1.0`.

---

## Immediate Next Steps (First 14 Days)

| # | Item | Owner | Due | Deliverable | Status |
|---|------|-------|-----|-------------|--------|
| 1 | Patch `cookie.ts` — remove hardcoded `.publiclogic.org` domain | Dev (Nate) | Day 1 | PR merged, `cookie.test.ts` green | ✅ Done |
| 2 | Fix `setJwtCookieOnResponse` — append instead of overwrite | Dev (Nate) | Day 1 | PR merged, append test green | ✅ Done |
| 3 | Remove `COOKIE_DOMAIN` default from `.env.sample` | Dev (Nate) | Day 1 | PR merged | ✅ Done |
| 4 | Add `auth-callback.test.ts` integration test (11 tests) | QA/Dev | Day 1 | Test file with 11 cases, CI green | ✅ Done |
| 5 | Add `cookie.test.ts` unit tests (9 tests) | QA/Dev | Day 1 | 9 unit tests passing | ✅ Done |
| 6 | Kickoff call — confirm plan, assign lanes, lock deliverables | Both | Day 2 | Meeting notes in workspace | ☐ |
| 7 | Threat model & cookie security review | Nate, Dev | Day 5 | One-page threat model doc | ☐ |
| 8 | Unify cookie-setting across OAuth and built-in login | Dev | Day 5 | All flows produce identical cookie attributes for same env | ☐ |
| 9 | Write auth-smoke runbook (`ops/runbooks/auth-smoke.md`) | Dev, Nate | Day 5 | Runbook with local + staging + prod verification steps | ☐ |
| 10 | Review & update 12 seed agenda items | Allie, Product | Day 5 | Updated `logicvilleAgendaStore.ts` committed | ☐ |
| 11 | Deploy to Fly.io staging + verify cookie flow end-to-end | Ops, Nate | Day 7 | `/health` 200, OAuth login sets cookies, refresh works | ☐ |
| 12 | Deploy Vercel frontend staging + verify login→redirect→session | Ops, Nate | Day 7 | Login page → OAuth → redirect → session restored | ☐ |
| 13 | Start board packet insert template | Product (Allie) | Day 10 | Draft with 3 bullets + 1 visual slot | ☐ |
| 14 | Define pilot metrics (6–8) | Both | Day 10 | Metrics doc filed | ☐ |

---

## Output Formats

### A) GitHub Issues Task List

Ready to copy/paste into GitHub Issues:

---

**Issue: Fix cookie domain bug in `cookie.ts`**
- **Labels:** `bug`, `auth`, `high-priority`
- **Assignee:** Nate
- **Description:** `createJwtCookie` in `n8drive/packages/core/src/cookie.ts` hardcodes `domain: '.publiclogic.org'` when `COOKIE_DOMAIN` is not set. This causes cookies to be rejected on localhost and non-publiclogic domains.
- **Acceptance Criteria:**
  - `createJwtCookie` omits `Domain` attribute when `COOKIE_DOMAIN` is unset or empty
  - `createJwtCookie` includes `Domain` only when `COOKIE_DOMAIN` is explicitly set
  - Unit test `cookie.test.ts` covers: no domain (unset), no domain (empty string), domain set, SameSite default, SameSite override, Secure in prod, no Secure in dev
- **Files:** `n8drive/packages/core/src/cookie.ts`, `n8drive/packages/core/test/cookie.test.ts`

---

**Issue: Fix Set-Cookie header overwrite in `setJwtCookieOnResponse`**
- **Labels:** `bug`, `auth`, `high-priority`
- **Assignee:** Nate
- **Description:** `setJwtCookieOnResponse` uses `res.setHeader('Set-Cookie', ...)` which replaces existing cookies. When `pj_refresh` is set first, it gets overwritten.
- **Acceptance Criteria:**
  - `setJwtCookieOnResponse` appends to existing `Set-Cookie` headers
  - Test confirms `jwt` and `pj_refresh` cookies coexist after login
- **Files:** `n8drive/packages/core/src/cookie.ts`, `n8drive/packages/core/test/cookie.test.ts`

---

**Issue: Remove `COOKIE_DOMAIN` default from `.env.sample`**
- **Labels:** `config`, `auth`, `high-priority`
- **Assignee:** Nate
- **Description:** `.env.sample` sets `COOKIE_DOMAIN=.publiclogic.org` which breaks local dev. Should be empty.
- **Acceptance Criteria:**
  - `.env.sample` has `COOKIE_DOMAIN=` (empty value)
  - `ENV_REFERENCE.md` documents proper usage
- **Files:** `n8drive/.env.sample`

---

**Issue: Add `authCallback.ts` integration test**
- **Labels:** `test`, `auth`, `high-priority`
- **Assignee:** Nate
- **Description:** `authCallback.ts` handles OAuth callbacks but has no dedicated tests. Add integration tests.
- **Acceptance Criteria:**
  - Missing provider token → 400
  - Logic Commons unavailable → 502
  - Success → JWT cookie set + redirect to `PJ_UI_URL`
  - Cookie uses correct attributes (no hardcoded domain)
- **Files:** `n8drive/apps/puddlejumper/test/authCallback.test.ts`

---

**Issue: Unify cookie-setting helper across login flows**
- **Labels:** `refactor`, `auth`, `high-priority`
- **Assignee:** Nate
- **Description:** OAuth callback uses `createSessionAndSetCookies` (correct) while built-in login and `authCallback.ts` use `setJwtCookieOnResponse` (was buggy). Ensure consistent cookie attributes.
- **Acceptance Criteria:**
  - All login flows produce cookies with identical `SameSite`, `Secure`, `Path` for the same `nodeEnv`
  - Integration test verifies consistency
- **Files:** `n8drive/packages/core/src/cookie.ts`, `n8drive/apps/puddlejumper/src/api/routes/auth.ts`, `n8drive/apps/puddlejumper/src/api/authCallback.ts`

---

**Issue: Write auth-smoke runbook**
- **Labels:** `documentation`, `auth`
- **Assignee:** Nate
- **Description:** Add operational runbook for verifying auth flows in local dev, staging, and production.
- **Acceptance Criteria:**
  - Local dev: cookie check steps
  - Staging: OAuth flow verification
  - Production: session restore + refresh cycle
  - Follows existing runbook format in `ops/runbooks/`
- **Files:** `n8drive/ops/runbooks/auth-smoke.md`

---

**Issue: Audit log viewer (API + UI) — V1.1 Priority 1**
- **Labels:** `feature`, `v1.1`
- **Assignee:** Nate
- **Description:** Ship `GET /api/audit` endpoint and Admin UI tab for viewing audit events.
- **Acceptance Criteria:**
  - Paginated, filterable by workspace/action/date/actor
  - Workspace isolation enforced
  - Read-only UI (no mutation)
  - Tests for pagination, filtering, isolation

---

**Issue: Webhook event idempotency — V1.1 Priority 2**
- **Labels:** `feature`, `v1.1`
- **Assignee:** Nate
- **Description:** Store processed webhook event IDs in SQLite with TTL to prevent duplicate processing.
- **Acceptance Criteria:**
  - Duplicate delivery returns 200 without side effects
  - Unknown event types logged and acked
  - TTL expiry tested

---

**Issue: Slack notification dispatcher — V1.1 Priority 3**
- **Labels:** `feature`, `v1.1`
- **Assignee:** Nate
- **Description:** Ship `SlackDispatcher` for approval-pending and approval-decided notifications.
- **Acceptance Criteria:**
  - Sends to configured webhook URL
  - Retry on 5xx
  - Tests for formatting, retry, channel routing

---

**Issue: Approval export (CSV/JSON) — V1.1 Priority 4**
- **Labels:** `feature`, `v1.1`
- **Assignee:** Nate
- **Description:** Ship `GET /api/approvals/export?format=csv|json` for compliance teams.
- **Acceptance Criteria:**
  - Workspace-scoped, date-range filtered
  - Includes chain step detail and dispatch evidence
  - Streamed response for large result sets
  - Tests for column correctness, JSON schema, isolation

---

**Issue: Email delivery for invitations — V1.1 Priority 5**
- **Labels:** `feature`, `v1.1`
- **Assignee:** Nate
- **Description:** Integrate transactional email for workspace invitation delivery.
- **Acceptance Criteria:**
  - Email sent with accept-link on invitation
  - Graceful fallback when provider unavailable
  - Tests for send call, token URL, fallback

---

### B) Board Packet Insert Template

```markdown
# [Municipality Name] — Technology Pilot Update

**Date:** YYYY-MM-DD
**Prepared by:** [Name, Title]

---

## What We're Doing

- **[One sentence]:** We are piloting PublicLogic's PuddleJumper platform to
  streamline [specific workflow, e.g., approval routing for public records requests].

## Why It Matters

- **Staff clarity:** Every task has a clear owner, due date, and definition of done.
- **Compliance:** Built-in flags for Open Meeting Law, Public Records, and retention.
- **Resident transparency:** Public-safe summaries generated automatically — no extra work.

## What We're Asking

- **[One-sentence ask]:** We request the Board's support to continue the 12-week pilot
  through [end date] with no additional budget impact.

---

*Visual suggestion: Include a single screenshot or diagram showing the approval
workflow or public tracking page. Keep it simple — one image, captioned.*

*Accessibility: This document should be provided in accessible PDF format (tagged PDF)
with alt text for any images. Font size ≥ 12pt. Plain language throughout.*
```

### C) 14-Day Checklist (Quick Action Table)

| Day | Item | Owner | Status |
|-----|------|-------|--------|
| 1 | Patch `cookie.ts` — fix domain + append | Dev (Nate) | ✅ Done |
| 1 | Fix `.env.sample` COOKIE_DOMAIN default | Dev (Nate) | ✅ Done |
| 1 | Add `cookie.test.ts` unit tests (9 tests) | QA/Dev | ✅ Done |
| 1 | Add `auth-callback.test.ts` integration tests (11 tests) | QA/Dev | ✅ Done |
| 2 | Kickoff call — confirm plan, lock lanes | Both | ☐ |
| 5 | Threat model & cookie security review | Nate, Dev | ☐ |
| 5 | Unify cookie-setting across login flows | Dev | ☐ |
| 5 | Write auth-smoke runbook | Dev, Nate | ☐ |
| 5 | Review & update 12 seed agenda items | Allie | ☐ |
| 7 | Deploy to Fly.io staging | Ops, Nate | ☐ |
| 7 | Deploy Vercel frontend staging | Ops, Nate | ☐ |
| 7 | Verify OAuth + cookies end-to-end on staging | Ops, Nate | ☐ |
| 10 | Draft board packet insert template | Product (Allie) | ☐ |
| 10 | Define pilot metrics (6–8) | Both | ☐ |
| 14 | CI staging smoke job created | QA, Ops | ☐ |
| 14 | Start Staff FAQ (6 Qs) | Product (Allie) | ☐ |

---

## Appendix

### Fly.io Smoke Deploy Commands

```bash
# 1. Build and deploy to staging
cd n8drive
pnpm run build
fly deploy --config fly.staging.toml --app publiclogic-puddlejumper-staging

# 2. Verify health
curl -s https://publiclogic-puddlejumper-staging.fly.dev/health | jq .

# 3. Check volume mount
fly ssh console --app publiclogic-puddlejumper-staging -C "ls -la /app/data/"

# 4. Verify OAuth login (open in browser)
# Navigate to: https://publiclogic-puddlejumper-staging.fly.dev/api/auth/github/login
# Expected: redirect to GitHub → callback → redirect to FRONTEND_URL with cookies set

# 5. Verify cookies after login (browser DevTools)
# Application → Cookies → look for: jwt, pj_refresh, pj_sso
# jwt: HttpOnly, Path=/, no Domain (or COOKIE_DOMAIN if set)
# pj_refresh: HttpOnly, Path=/api
```

### Minimal Verification Checklist (Post-Deploy)

| Check | Command / Step | Expected |
|-------|----------------|----------|
| Health | `curl /health` | 200, all subsystems `ok` |
| DB writable | Health check `volume` field | `"ok"` |
| OAuth redirect | GET `/api/auth/github/login` | 302 to GitHub |
| OAuth callback | Complete GitHub flow | Redirect to frontend with `jwt` cookie |
| Session restore | GET `/api/auth/status` with cookie | `authenticated: true` |
| Refresh | POST `/api/refresh` with `pj_refresh` cookie | 200 with new JWT |
| CSRF check | POST `/api/login` without `X-PuddleJumper-Request` | 403 |
| Unauthenticated access | GET `/api/capabilities/manifest` without auth | 401 |

### Assumptions

1. **Fly.io staging app exists** as `publiclogic-puddlejumper-staging` with a separate volume. If not, create with `fly apps create publiclogic-puddlejumper-staging` and `fly volumes create pj_data --region ewr --size 1 --app publiclogic-puddlejumper-staging`.

2. **GitHub OAuth app configured** with Client ID and Secret in staging env vars. Google and Microsoft OAuth can be deferred to Week 3.

3. **Vercel project Root Directory** is set to `n8drive/web` in Vercel dashboard. If not, fix in Settings → General → Root Directory.

4. **Grafana instance available** (hosted or self-hosted). If not, use Fly.io's built-in metrics as an interim solution and defer Grafana to Week 4.

5. **Email provider (SendGrid/Postmark)** will be selected and account created by Week 9. No commitment needed in Weeks 1–8.

6. **Town data ownership** is assumed per the Logicville Living Agenda working rules. Formal documentation will be produced in Week 8–9 (task E-6).

7. **VAULT™ / ARCHIEVE™ are described at high level only** per IP notice. No proprietary mechanics are exposed in this plan or in public artifacts.

### Open Questions

1. **Which Grafana host?** If using Grafana Cloud, Nate needs to create the account. If self-hosted, add a Fly.io machine. Decision needed by Week 2.

2. **Email provider preference?** SendGrid vs Postmark — both work. SendGrid has a free tier (100 emails/day). Decision needed by Week 8.

3. **Microsoft OAuth tenant ID** — currently set to `common` in `.env.sample`. For production, should this be locked to a specific tenant? Decision needed by Week 3.

4. **CORS_ALLOWED_ORIGINS for production** — currently empty (defaults to none). Must be set to `https://pj.publiclogic.org` before production deploy. Nate to configure in Week 5.

5. **Staging domain** — is `publiclogic-puddlejumper-staging.fly.dev` acceptable, or does a custom staging domain need to be configured? Decision by Week 1.
