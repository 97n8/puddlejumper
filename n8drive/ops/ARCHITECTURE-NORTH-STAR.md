# PuddleJumper — Architecture North Star

> **Date:** February 15, 2026  
> **Status:** Locked for 90-day planning cycle  
> **Prerequisite reading:** [SYSTEM-GUIDE.md](SYSTEM-GUIDE.md)

---

## 1. Control Plane Value Statement

PJ is the control plane that **makes municipal operations auditable, repeatable, and safe by guaranteeing that every action touching production systems passes through a governed pipeline — with human approval, atomic dispatch, and immutable evidence — before anything executes.**

A municipality gets three things from PJ that they cannot get from a generic workflow tool:

1. **Fail-closed governance.** Every action is denied by default and must earn approval through a rule pipeline. Nothing executes without evidence.
2. **Dispatch isolation.** PJ separates the decision ("should this happen?") from the execution ("make it happen") from the authority ("is this allowed?"). No single layer can both decide and execute.
3. **Operational visibility.** Every approval, rejection, dispatch, retry, failure, and CAS conflict is metered and alertable. Municipality admins see what happened, when, by whom, and whether it succeeded — without reading logs.

The value proposition to a municipality: **"You can automate operations without losing control."**

---

## 2. Target Architecture Diagram

```
                          ┌──────────────────────┐
                          │      VAULT            │
                          │  (Authority Layer)    │
                          │                       │
                          │  Policy Store         │
                          │  Audit Ledger         │
                          │  Manifest Registry    │
                          │  Release Auth         │
                          └──────────┬────────────┘
                                     │
                            policy queries │ audit writes
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│  PuddleJumper (Control Plane)                                          │
│                                                                        │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │ API Surface  │  │ Governance       │  │ Approval Pipeline         │  │
│  │             │  │ Engine           │  │                           │  │
│  │ /execute    │──▶ Rule Pipeline    │  │ pending → approved →      │  │
│  │ /approvals  │  │ (fail-closed)    │  │ dispatching → dispatched  │  │
│  │ /actions    │  │                  │  │                           │  │
│  │ /webhooks   │  │ Intent Eval      │──▶ Approval Store (SQLite)   │  │
│  └─────────────┘  │ Charter Check    │  │ CAS double-dispatch lock  │  │
│                   │ Permission Gate  │  └────────────┬──────────────┘  │
│                   │ Plan Generation  │               │                 │
│  ┌─────────────┐  └──────────────────┘               │                 │
│  │ Control     │                                     │                 │
│  │ Plane UI    │  ┌──────────────────────────────────▼──────────────┐  │
│  │ (Admin      │  │ Dispatch Pipeline                               │  │
│  │  Surface)   │  │                                                 │  │
│  │             │  │ DispatcherRegistry                              │  │
│  │ Approvals   │  │   ├─ GitHubDispatcher    (branches, PRs)       │  │
│  │ Metrics     │  │   ├─ WebhookDispatcher   (HTTP POST/GET)       │  │
│  │ Audit Log   │  │   ├─ SharePointDispatcher (planned)            │  │
│  │ Connector   │  │   └─ ... (extensible)                          │  │
│  │ Status      │  │                                                 │  │
│  └─────────────┘  │ RetryPolicy (exponential backoff, 5xx/network) │  │
│                   └─────────────────────┬───────────────────────────┘  │
│                                         │                              │
│  ┌──────────────────────────────────────▼──────────────────────────┐   │
│  │ Observability                                                   │   │
│  │ Prometheus counters, gauges, histograms → Grafana → Alerts     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
               │                              │
     execute   │                    execute    │
               ▼                              ▼
      ┌────────────────┐            ┌────────────────┐
      │ Connectors     │            │ Substrates     │
      │ (Execute only) │            │ (Store only)   │
      │                │            │                │
      │ GitHub API     │            │ SharePoint     │
      │ HTTP Endpoints │            │ Repos          │
      │ Slack API      │            │ Databases      │
      └────────────────┘            └────────────────┘
```

### Canonical Flow (preserved)

```
User → PuddleJumper API → [VAULT policy check] → Governance Engine
  → Approval Store → Admin Decision → Dispatch Pipeline
  → Connector → Substrate → PuddleJumper (evidence) → [VAULT audit write]
```

VAULT calls shown in brackets because VAULT does not exist as a running service yet. The interface boundary is defined now. The service ships later. PJ's code must be written today as if VAULT exists — query a policy interface, write to an audit interface — so that wiring VAULT in is a configuration change, not a rewrite.

---

## 3. Foundational Layer Decision

### Selected: Multi-step Approval Chains + Control Plane UI

**Why these two. Why together.**

The governance engine evaluates and generates plans. The approval gate provides human sign-off. The dispatch pipeline executes. All three work. But the approval gate is binary: one admin, one decision, one dispatch. That's V1. Municipal operations require:

- **Sequential approvals.** Department head approves, then city manager approves, then legal signs off.
- **Parallel approvals.** IT and legal both must approve before dispatch.
- **Conditional routing.** If the action touches production, add the CTO. If it's a policy deploy, add compliance.

None of this requires a rule engine. It requires **approval chain definitions** — a data structure, stored in SQLite, that tells the approval pipeline how many approvals are needed, in what order, with what routing logic.

**This is PJ's layer, not VAULT's.** VAULT defines *who is authorized to approve what*. PJ defines *how approvals are routed and sequenced*. The routing is operational logistics. The authorization is governance authority. These are different concerns.

The Control Plane UI is the second piece because approval chains are useless without a surface for admins to see them. The current system has an API but no dedicated admin interface for operations. An admin managing 5 pending approvals across 3 steps each cannot do that from `curl`. The UI surfaces:

- Approval queue with chain progress (step 2 of 3 approved)
- Dispatch status and retry history
- Metric dashboards (embedded Grafana or native)
- Connector health
- Audit trail

### Why NOT the other candidates

| Candidate | Verdict | Reason |
|-----------|---------|--------|
| Rule Engine | Postpone | The governance engine's 1304-line procedural pipeline works. Extracting a generic rule engine is a rewrite, not an extension. Revisit when the pipeline has 3+ municipalities with divergent rule sets. |
| Policy DSL | Reject for PJ | Policy definitions belong in VAULT. A PJ-native Policy DSL blurs the boundary. PJ should *consume* policy, not *define* it. |
| Role-based Governance Policies | Partial — embed in approval chains | The current admin/viewer binary is insufficient for chain routing. Add roles (department_head, legal, cto) as approval chain participants, not as a standalone RBAC system. |
| Automation Workflows | Postpone | Multi-action sequences triggered by events is a workflow engine. PJ is a control plane, not a workflow engine. If needed, model it as chained governed actions where the completion of one triggers submission of the next — keeping each action individually governed. |
| Connector Marketplace | Postpone | Only 2 active dispatchers. Marketplace abstraction is premature. When there are 5+, extract the registration/discovery pattern. |

### How Approval Chains respect the PJ/VAULT boundary

```
VAULT responsibility:
  - "User X is authorized to approve actions of type Y for municipality Z"
  - "Actions touching production require compliance sign-off"
  - Policy definitions, role-to-authority mappings

PJ responsibility:
  - "This approval chain has 3 steps: dept_head → legal → admin"
  - "Step 2 is pending. Step 1 was approved by user X at timestamp T."
  - Routing logic, sequencing, status tracking, UI rendering
  
Integration point (future):
  PJ asks VAULT: "For this action in this municipality, what approval chain template applies?"
  VAULT returns: { steps: [{ role: "dept_head" }, { role: "legal" }, { role: "admin" }] }
  PJ instantiates the chain and manages progression.
```

Until VAULT exists, PJ uses a local chain definition table. When VAULT ships, the query replaces the local lookup. No structural change to PJ's approval pipeline.

---

## 4. Risk Guardrails

### What NOT to Build

| Don't Build | Why |
|-------------|-----|
| Policy definition UI in PJ | That's VAULT's surface. PJ consumes policy, it doesn't author it. |
| Generic rule engine | The procedural pipeline works. Genericizing it adds abstraction without adding capability. |
| Connector-side decision logic | Connectors execute fully specified instructions. No interpretation, no branching. |
| Event-driven automation engine | PJ gates and dispatches. If something needs to trigger automatically on an event, it submits a governed action. The event is an input, not an authority. |
| Multi-tenant data partitioning | SQLite handles the current scale. Don't architect for 1000 tenants before you have 5. |
| Custom DSL for approval routing | Use data (JSON chain definitions in SQLite rows) not language. A DSL is a language design project. |

### What to Postpone

| Postpone | Trigger to revisit |
|----------|-------------------|
| Rule engine extraction | 3+ municipalities with >30% rule divergence |
| Connector marketplace | 5+ active dispatchers |
| VAULT service build | When PJ has a live municipal customer needing compliance audit separation |
| Workflow chaining | When a customer needs "deploy policy then notify then archive" as one sequence |
| Database migration off SQLite | When WAL-mode write throughput becomes a bottleneck (>100 writes/sec sustained) |

### What Would Destabilize the System

1. **Rewriting the governance engine.** 1304 lines, fail-closed, working. Refactoring it into a plugin architecture or rule engine changes the failure mode from "explicit denial" to "misconfigured rule set." The procedural pipeline is a feature, not technical debt.

2. **Merging PJ and VAULT.** The moment PJ holds policy definitions, you have a single system that both decides and executes. That's the same architecture failure that PJ was built to prevent. The boundary is load-bearing.

3. **Letting the UI write governance rules.** The Control Plane UI renders state and accepts operational actions (approve, reject, dispatch). It does not define what actions are allowed. If the UI can create policy, the admin becomes the authority — and VAULT becomes redundant.

4. **Making connectors stateful.** Connectors execute and return results. If a connector stores state, retries on its own, or makes conditional decisions, you have distributed authority. All state lives in PJ. All authority lives in VAULT.

5. **Adding a message queue.** The current synchronous dispatch (with retry) is deterministic and testable. An async message queue adds eventual consistency, dead letter handling, and ordering guarantees — all infrastructure that's unnecessary at current scale and makes the system harder to reason about.

### Where Abstraction Should Stop

- **Approval chains: data, not meta-programming.** A chain is a JSON array of steps with roles and conditions. It is not a state machine DSL, not a BPMN engine, not a graph executor. A `for` loop over chain steps is fine.
- **Retry policy: parameters, not strategy pattern.** `maxAttempts`, `baseDelayMs`, `onRetry` callback. Not a pluggable retry strategy factory. The exponential backoff is the strategy.
- **Roles: enum, not RBAC framework.** Add `department_head`, `legal`, `cto` to the role type. Don't build a role hierarchy engine.

### PJ/VAULT Merge Risks (specific)

| Risk | How it manifests | Prevention |
|------|-----------------|------------|
| PJ stores policy definitions | A "chain templates" table in PJ's SQLite that defines who can approve what | Chain templates define *routing*. Authorization checks query VAULT (or the local stand-in). |
| PJ interprets compliance rules | The governance engine evaluates municipality-specific compliance | Compliance evaluation is a VAULT query result, not a PJ computation. PJ passes-through VAULT's yes/no. |
| The UI becomes a policy editor | Admin can create/modify governance rules through the UI | The UI is read-only for policy. It's read-write for operational actions only. |
| Audit log lives only in PJ | PJ's SQLite is the sole audit record | PJ writes audit events. VAULT holds the immutable ledger. PJ's audit is operational; VAULT's is compliance. |

---

## 5. 30 / 60 / 90 Day Roadmap

### Days 1–30: Foundation Expansion

**Goal:** Approval chains exist. The pipeline handles multi-step approvals.

| Week | Deliverable | Detail |
|------|------------|--------|
| 1 | Approval chain data model | `approval_chains` table in SQLite. Chain = ordered list of steps, each with a required role. `approval_chain_steps` table tracking per-step status. Migrate existing single-step approvals to chain length 1. |
| 2 | Chain progression logic | When step N is approved, step N+1 becomes `pending`. When all steps are approved, the approval enters `approved` state (eligible for dispatch). Rejection at any step is terminal. |
| 3 | API surface for chains | `GET /api/approvals/:id/chain` — returns chain progress. `POST /api/approvals/:id/chain/:stepId/decide` — approve/reject a specific step. Existing single-step `/decide` endpoint becomes a shortcut for chain-of-1. |
| 4 | Tests + deploy | Chain lifecycle tests (sequential 3-step, rejection at step 2, dispatch after final step). Backward compatibility: all existing single-step tests pass unchanged. Target: 240+ tests. |

**What PJ gains:** Multi-step approval routing. A department head can approve, then a city manager can approve, then dispatch happens. No single admin is a bottleneck.

### Days 31–60: Controlled Growth

**Goal:** Control Plane UI ships. A municipality admin can manage approvals without `curl`.

| Week | Deliverable | Detail |
|------|------------|--------|
| 5–6 | Control Plane UI — approval queue | Server-rendered (or lightweight SPA) admin page at `/pj/admin`. Shows pending approvals with chain progress, sortable by age/municipality/intent. Approve/reject buttons per chain step. |
| 7 | Control Plane UI — operational dashboard | Dispatch history (last 50), retry counts, connector health status. Metric summaries (not full Grafana — just the 4 numbers an admin needs: pending, success rate, retry rate, avg latency). |
| 8 | Parallel approval support | Chain steps can be marked `parallel: true`. Parallel steps all become pending simultaneously. Chain advances when all parallel steps in a group are approved. |

**What a municipality can touch:** An admin logs in, sees 3 pending approvals, clicks into one, sees "Step 1: Department Head (approved by Jane) → Step 2: Legal (pending, assigned to you)", approves step 2, and the action dispatches. No API knowledge required.

### Days 61–90: Platform Identity

**Goal:** VAULT interface defined. PJ consumes external policy. The system is defensible.

| Week | Deliverable | Detail |
|------|------------|--------|
| 9 | VAULT policy interface (local) | Define the `PolicyProvider` interface: `getChainTemplate(action, municipality): ChainTemplate`, `checkAuthorization(user, action): boolean`, `writeAuditEvent(event): void`. Ship a `LocalPolicyProvider` backed by SQLite that PJ uses today. |
| 10 | Governance engine consumes PolicyProvider | Replace hardcoded permission checks in the 1304-line pipeline with `policyProvider.checkAuthorization()` calls. Replace hardcoded chain-of-1 with `policyProvider.getChainTemplate()`. Engine logic unchanged — source of truth changes. |
| 11 | Connector retry policy on registration | `registry.register(dispatcher, { retryPolicy })` — move retry config from route handlers to dispatcher registration. Add `SharePointDispatcher` stub. |
| 12 | Documentation + hardening | Update SYSTEM-GUIDE.md. Update Grafana dashboard for chain metrics. Add alert for chain step stuck >24h. Run full regression. Target: 280+ tests. |

**What makes this defensible:** PJ is no longer a custom app with hardcoded rules. It's a control plane with a defined policy consumption interface, pluggable dispatchers, multi-step approval chains, and an admin UI. VAULT can ship as a separate service and PJ wires to it by swapping `LocalPolicyProvider` for `RemotePolicyProvider`. That's the architecture that scales to multiple municipalities without forking the codebase.

**What separates PJ from a generic workflow tool:** PJ doesn't let you define arbitrary workflows. It governs a specific thing: the evaluation, approval, and dispatch of municipal operations. The pipeline is opinionated. The approval chains are structured, not freeform. The dispatchers execute against known connectors, not arbitrary integrations. That narrowness is the defensibility — a generic tool can't be fail-closed by default because it doesn't know what "closed" means for your domain.

---

## 6. Explicit "Not Doing" List

| Item | Status | Rationale |
|------|--------|-----------|
| Replace SQLite | Not doing | WAL mode handles current scale. Volume mount on Fly.io works. No justification for Postgres complexity. |
| Build VAULT as a service | Not in 90 days | Define the interface. Ship the local provider. Build the service when a customer needs compliance-grade audit separation. |
| Rule engine / Policy DSL | Not doing | The procedural pipeline is the governance logic. It's tested, fail-closed, and explicit. Abstraction adds risk without adding capability. |
| Connector marketplace | Not doing | 2-3 active dispatchers. Registration is a function call. Marketplace is premature. |
| Event-driven automation | Not doing | Events submit governed actions. They don't bypass the pipeline. |
| RBAC framework | Not doing | Add role strings to the type union. Route approval chain steps by role. Don't build a role hierarchy engine. |
| Message queue / async dispatch | Not doing | Synchronous dispatch + retry is deterministic and testable. Async adds complexity without solving a current problem. |
| Multi-region deployment | Not doing | Single Fly.io machine in EWR. Add regions when latency or availability requires it. |
| Mobile UI | Not doing | The Control Plane UI is a desktop admin surface. Municipal admins use desktop browsers. |
| AI/LLM integration for decisions | Not doing | The governance engine makes deterministic decisions from rules. LLM interpretation of policy is non-deterministic and non-auditable. |

---

## Appendix: Metric Additions (90-day target)

| Metric | Type | When |
|--------|------|------|
| `approval_chain_steps_total` | counter | Per chain step created |
| `approval_chain_step_decided_total` | counter | Per chain step decided (labels: approved/rejected) |
| `approval_chain_completed_total` | counter | Full chain approved |
| `approval_chain_rejected_total` | counter | Chain rejected at any step |
| `approval_chain_step_pending_gauge` | gauge | Currently pending chain steps |
| `approval_chain_step_time_seconds` | histogram | Time per step (creation to decision) |

These compose with existing metrics. `approvals_created_total` remains the top-level count. Chain metrics provide per-step granularity.

---

## Phase 1 Completion Assessment (Day 90)

> **Date:** February 16, 2026

### What shipped

| Milestone | Deliverable | Status | Evidence |
|-----------|------------|--------|----------|
| **Days 1–30** | Approval chain data model | ✅ Shipped | `chainStore.ts` — `approval_chain_templates` + `approval_chain_steps` tables, sequential + parallel step progression |
| | Chain progression logic | ✅ Shipped | `decideChainStep()` → activate next order group, rejection skips remaining steps |
| | API surface for chains | ✅ Shipped | `chainTemplates.ts` — 5 CRUD endpoints with RBAC + tier enforcement |
| | Tests | ✅ Shipped | `chainStore.test.ts`, `chain-templates.test.ts`, `chain-integration.test.ts`, `parallel-approval.test.ts` |
| **Days 31–60** | Control Plane UI — approval queue | ✅ Shipped | `admin.html` — Approvals tab with chain progress column, status filters, pagination |
| | Operational dashboard | ✅ Shipped | Dashboard tab — pending count, success rate, retry count, avg latency, recent dispatches |
| | Parallel approval support | ✅ Shipped | Steps at same `order` value all activate simultaneously; chain advances when all are approved |
| **Days 61–90** | PolicyProvider interface (local) | ✅ Shipped | `policyProvider.ts` — `checkAuthorization`, `getChainTemplate`, `writeAuditEvent` |
| | Governance engine consumes PolicyProvider | ✅ Shipped | `governanceEngine.ts` calls `policyProvider.checkAuthorization()` when available |
| | Connector retry policy on registration | ✅ Shipped | `DispatcherRegistry.register(dispatcher, retryPolicy?)` in `dispatch.ts` |
| | SharePointDispatcher stub | ✅ Shipped | `dispatchers/sharepoint.ts` — returns `skipped`, registered with retry policy |
| | Documentation | ⚠️ Partial | SYSTEM-GUIDE.md does not yet reference chains, PolicyProvider, or admin UI |

### What did not ship

| Item | Gap | Severity |
|------|-----|----------|
| Chain Prometheus metrics | 6 metrics from appendix not emitted (`approval_chain_steps_total`, etc.) | Medium — metrics are operational visibility, not correctness |
| Grafana dashboard for chains | No chain-specific panels in `puddlejumper-approvals-dashboard.json` | Medium — existing dashboard covers top-level approvals |
| Chain-stuck >24h alert | No alert rule in `ops/alerts/` | Low — manual monitoring works at current scale |
| SYSTEM-GUIDE.md update | No mention of chains, PolicyProvider, admin chain management | Medium — affects onboarding for new operators |

### Test count

507 tests passing (73 logic-commons + 434 puddlejumper). Target was 280+.

### Open PRs (in-flight, not yet merged to main)

| PR | Title | What it adds |
|----|-------|-------------|
| #32 | Make PolicyProvider async for RemotePolicyProvider | `Promise` return types on all PolicyProvider methods; `registerManifest`, `authorizeRelease`, `classifyDrift` stubs |
| #33 | Strip lockfile churn from PRs #32 and #34 | Removes +2786/-2242 lockfile noise |
| #34 | Admin-only chain template endpoints | GET chain templates requires admin/owner (was open to viewers) |
| #35 | Harden stepId validation + role matching docs | Type-validates `stepId` before `chainStore.getStep()` |
| #38 | Governance engine consumes async PolicyProvider (Week 10) | Wires `registerManifest` pre-flight + `authorizeRelease` dispatch gate |

**Recommended merge order:** #33 → #34 → #32 → #38 → #35 (PRs #32 and #38 both touch `policyProvider.ts`; #35 rebases cleanly after #32/#33).

---

## 7. Phase 2 Plan: Days 91–180

> **Status:** Proposed — requires owner review before lock  
> **Prerequisite:** Merge open PRs #32–#38. Resolve staging Fly.io issue (#20).

### Strategic intent

Phase 1 built the governance machinery: chains, PolicyProvider, admin UI, dispatchers with retry. Phase 2 makes it **operationally real**: close the documentation gaps, add the observability that the appendix promised, ship the V1.1 features that actual users need (email delivery, audit visibility), and harden the system for a second municipality.

Phase 2 does NOT build VAULT, a rule engine, or a connector marketplace. Those triggers have not been met (see Section 4 guardrails). Phase 2 finishes what Phase 1 started and adds the operational polish that separates a prototype from a product.

### Days 91–120: Finish Phase 1 + Observability

**Goal:** Ship the Phase 1 items that didn't land. No new features until the foundation is complete.

| Week | Deliverable | Detail |
|------|------------|--------|
| 13 | Chain Prometheus metrics | Emit the 6 metrics from the appendix. Instrument `chainStore.createChainForApproval()`, `decideChainStep()`, and chain completion paths. Add `approval_chain_step_pending_gauge` via periodic scan or increment/decrement on step state transitions. |
| 14 | Grafana dashboard + alert | Add chain-specific panels to `puddlejumper-approvals-dashboard.json`: step throughput, pending step gauge, step decision latency histogram. Add `ChainStepStuck24h` alert rule to `ops/alerts/`. |
| 15 | SYSTEM-GUIDE.md update | Document: multi-step approval chains (data model, API endpoints, admin UI workflow), PolicyProvider interface (what it is, how LocalPolicyProvider works, how RemotePolicyProvider will swap in), control plane UI tabs and their purpose. |
| 16 | Merge open PRs + regression | Land #32–#38 in order. Run full test suite. Fix any conflicts. Cut v1.1.0-rc1 tag. |

**Exit criteria:** All 6 chain metrics emitting in `/metrics`. Grafana dashboard renders chain panels. SYSTEM-GUIDE.md covers chains and PolicyProvider. 0 open Phase 1 PRs.

### Days 121–150: Operational Readiness

**Goal:** Ship the V1 known limitations that block real municipal usage.

| Week | Deliverable | Detail |
|------|------------|--------|
| 17 | Audit log UI | Add "Audit" tab to admin.html. Display `audit_events` table with filters: event type, operator, date range. Read-only — PJ audit is operational, not compliance (that's VAULT). Backend: `GET /api/admin/audit` already exists; UI consumes it. |
| 18 | Email delivery for invitations | Integrate SendGrid (or Postmark) for workspace invitation emails. Behind feature flag (`EMAIL_PROVIDER=sendgrid|none`). Fallback to copy-link when `none`. Invitation email template: workspace name, inviter, accept link, expiry. |
| 19 | Webhook signature verification | Verify inbound webhook signatures (`X-Hub-Signature-256` for GitHub, configurable HMAC for custom). Reject unverified payloads with 401. Connector-level config: `{ webhookSecret: string }` at registration. |
| 20 | Staging deployment fix | Resolve issue #20 (SQLite volume permissions on Fly.io staging). Deploy v1.1.0-rc1 to staging. Run E2E smoke tests against staging. |

**Exit criteria:** Audit tab renders events. Invitations send real emails (with flag on). Webhook signatures verified. Staging deploys and passes smoke tests.

### Days 151–180: Multi-Workspace + Hardening

**Goal:** Remove the single-workspace-per-user limitation. Harden for second municipality onboarding.

| Week | Deliverable | Detail |
|------|------------|--------|
| 21 | Multi-workspace support | Users can create additional workspaces. Workspace switcher in UI. Each workspace has independent tiers, members, chains, approvals. Session token carries `activeWorkspaceId`. |
| 22 | Workspace ownership transfer | `POST /api/workspaces/:id/transfer` — owner nominates new owner (must be existing admin member). Requires confirmation from both parties. Audit event logged. |
| 23 | API rate limiting hardening | Current rate limiter exists (`rateLimit.ts`). Add per-workspace rate limits (not just per-IP). Add rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`). Document limits in API reference. |
| 24 | v1.1.0 release | Full regression (target: 550+ tests). Update CHANGELOG.md. Update deployment docs. Tag v1.1.0. Deploy to production. |

**Exit criteria:** Users can own multiple workspaces. Ownership transfer works. Rate limits are per-workspace with standard headers. v1.1.0 tagged and deployed.

### Phase 2 "Not Doing" List

| Item | Why not in Phase 2 |
|------|-------------------|
| Build VAULT as a service | No municipal customer requiring compliance-grade audit separation yet. `LocalPolicyProvider` covers current needs. Trigger: first compliance audit request. |
| Stripe billing integration | Manual tier upgrades work. Stripe requires PCI compliance infrastructure. Trigger: when free-to-Pro conversion volume justifies the integration cost. |
| Connector marketplace | 4 dispatchers (GitHub, Webhook, SharePoint stub, Slack). Still under the 5+ trigger. |
| Rule engine extraction | Single municipality. No divergent rule sets to compare. |
| Workflow chaining | No customer has requested multi-action sequences. Individual governed actions remain sufficient. |
| RemotePolicyProvider (HTTP-to-VAULT) | Interface is defined (PR #32). Implementation waits for VAULT service. Building the HTTP client without a server to call is speculative. |
| Mobile UI | Municipal admins confirmed on desktop. No usage data suggesting mobile need. |

### Phase 2 Risks

| Risk | Mitigation |
|------|-----------|
| Multi-workspace migration breaks existing single-workspace users | Migration script auto-assigns existing workspace as `activeWorkspaceId`. No user action required. Add migration test. |
| SendGrid email delivery in fail-closed pipeline | Email is notification, not governance. Email failure does not block invitation creation — invitation record exists, copy-link fallback always works. |
| Webhook signature verification rejects legitimate payloads | Feature flag per-connector: `{ verifySignature: true|false }`. Default `false` for existing connectors. New connectors default `true`. |
| Staging Fly.io volume permissions (issue #20) | Fix in Week 20 is gated — v1.1.0 does not deploy to production until staging passes smoke tests. |
