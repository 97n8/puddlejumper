# 🦆 PuddleJumper — Best & Novel Features

A curated guide to the most distinctive capabilities across the PuddleJumper ecosystem.

---

## 1. Fail-Closed Governance Engine

The core decision engine denies actions by default. Every operation must pass through a rule pipeline that validates intent, authority, and policy before anything executes. The engine classifies intents into three tiers — **launcher** (low-risk, immediate), **governed** (requires approval chain), and **legacy** (backward-compatible) — and routes each through appropriate validation.

**Key files:** `n8drive/apps/puddlejumper/src/engine/governanceEngine.ts`, `validation.ts`

---

## 2. Multi-Step Approval Chains

Approval workflows support both **parallel** and **sequential** step progression. Steps at the same order level run in parallel (all must approve); progression across order levels is sequential. A single rejection at any step terminates the entire chain. Reusable chain templates define routing order by required role, keeping policy (VAULT) separate from sequencing (PJ).

**Key files:** `n8drive/apps/puddlejumper/src/engine/chainStore.ts`, `approvalStore.ts`

---

## 3. Dispatch Isolation Architecture

The system cleanly separates **decision** from **execution**. The governance engine produces a plan; the dispatch layer executes it against external connectors (GitHub, SharePoint, Slack, webhooks, and more). Each connector implements a standard `ConnectorDispatcher` interface with health checks, rate-limit awareness, retry policies, and dry-run support.

**Key files:** `n8drive/apps/puddlejumper/src/engine/dispatch.ts`, `dispatchers/github.ts`

---

## 4. Idempotency Store with In-Flight Deduplication

A SQLite-backed idempotency layer prevents duplicate processing of identical requests. Features include:

- **Payload hash tracking** — detects duplicate payloads even with different request IDs
- **In-flight deduplication** — concurrent identical requests wait for the first to complete (exponential backoff from 100 ms to 1 s)
- **Result replay** — subsequent duplicates receive the cached result within a 5-second window
- **Schema versioning** — safe store upgrades without data loss

**Key file:** `n8drive/apps/puddlejumper/src/engine/idempotencyStore.ts`

---

## 5. PolicyProvider Seam (PJ ↔ VAULT Boundary)

A clean interface separates the control plane (PJ) from the authority layer (VAULT). PJ asks *"Is this operator authorized?"* and *"What approval chain applies?"*; VAULT answers. Today a `LocalPolicyProvider` (SQLite) ships with PJ. Swapping to a `RemotePolicyProvider` (HTTP) requires only a config change — no code rewrite. This is a textbook config-swap migration pattern.

**Key files:** `n8drive/apps/puddlejumper/src/engine/policyProvider.ts`, `remotePolicyProvider.ts`

---

## 6. VAULT — Append-Only Compliance Engine

The VAULT package provides an immutable audit ledger, manifest registry, and authorization service:

- **Audit Ledger** — append-only event log (insert-or-fail on duplicate `eventId`)
- **Manifest Registry** — tracks process deployment lifecycle: registered → approved → authorized → deployed
- **M.G.L. Citation Tracking** — embeds Massachusetts General Laws references directly in process packages
- **FormKey-based Retrieval** — municipal processes are indexed by FormKey for efficient lookup

**Key files:** `n8drive/packages/vault/src/auditLedger.ts`, `manifestRegistry.ts`, `schema.ts`

---

## 7. Prompt Injection Detection

The governance engine scans all inputs for prompt injection patterns (`ignore rules`, `bypass governance`, `auto-approve`, `disable audit`, etc.) and rejects them before they reach the decision pipeline. This protects against social-engineering attacks in AI-adjacent municipal workflows.

**Key file:** `n8drive/apps/puddlejumper/src/engine/validation.ts`

---

## 8. SSRF-Safe Canonical Source Fetcher

When the engine fetches external process definitions, it validates the target against a private-IP blocklist (RFC 1918, link-local, cloud metadata at `169.254.169.254`) and an allowed-host whitelist. DNS resolution is checked before any HTTP request is made, preventing server-side request forgery.

**Key file:** `n8drive/apps/puddlejumper/src/api/canonicalSource.ts`

---

## 9. Refresh Token Family Rotation with Replay Detection

The auth layer implements token family chains. When a refresh token is used, a new token is issued and linked to the same family. If a **revoked** token is replayed, the entire family is immediately revoked — protecting against token theft even if the attacker obtains a single refresh token.

**Key file:** `n8drive/apps/logic-commons/src/lib/refresh-store.ts`

---

## 10. Compare-And-Swap Dispatch Lock

The approval store uses an atomic SQL `UPDATE ... WHERE approval_status = 'approved'` to transition approvals to `dispatching`. This prevents double-dispatch under concurrency without requiring external distributed locks — a pattern well-suited to SQLite's serialized write model.

**Key file:** `n8drive/apps/puddlejumper/src/engine/approvalStore.ts`

---

## 11. Deterministic Plan Hashing

Every governance decision includes a SHA-256 hash of the canonicalized plan. The canonicalization function recursively normalizes objects (sorted keys, stable JSON), ensuring identical plans always produce the same hash. This enables tamper detection and audit verification.

**Key file:** `n8drive/apps/puddlejumper/src/engine/hashing.ts`

---

## 12. Tier-Based Resource Quotas

Workspaces are governed by plan tiers (Free / Pro) with enforced limits on templates, approvals, and members. Middleware checks quotas before creating resources, returning a clear error when a limit is reached — enabling self-service without uncontrolled growth.

**Key files:** `n8drive/apps/puddlejumper/src/config/tierLimits.ts`, `api/middleware/enforceTierLimit.ts`

---

## 13. Statutory Records Retention Mapping

The validation layer includes a built-in retention schedule mapping document types to ISO 8601 durations and storage routes (e.g., minutes → 7 years at `records/meetings`, permits → 10 years at `records/permits`). This ensures municipal records comply with retention requirements by default.

**Key file:** `n8drive/apps/puddlejumper/src/engine/validation.ts` (`RETENTION_MAP`)

---

## 14. SSO Token Exchange Bridge

A dedicated `/api/auth/token-exchange` endpoint accepts an external provider's access token (e.g., an MSAL token from PublicLogic OS) and issues a PuddleJumper session. This enables seamless single sign-on between independently deployed applications without sharing session stores.

**Key files:** `n8drive/apps/logic-commons/src/routes/token-exchange.ts`, `publiclogic-os-ui/lib/pj.js`

---

## 15. Generic OAuth Provider Factory

Instead of writing per-provider OAuth code, a declarative `OAuthProvider` interface defines authorize URLs, token endpoints, and scopes. Tenant-aware dynamic URLs (for Microsoft multi-tenant) and a pluggable state store for CSRF protection are built in. Adding a new OAuth provider is configuration, not code.

**Key file:** `n8drive/apps/logic-commons/src/lib/oauth.ts`

---

## 16. Lightweight Approval Metrics (Prometheus-Compatible)

An in-process metrics system tracks counters, gauges, and histograms for the approval pipeline without requiring an external metrics agent. Histogram buckets span 100 ms to 1 hour, and the output is structured JSON compatible with log-based metric aggregation or a Prometheus scrape endpoint.

**Key file:** `n8drive/apps/puddlejumper/src/engine/approvalMetrics.ts`

---

## 17. Public Records Request (PRR) Workflow

A full lifecycle for public records requests: submitted → acknowledged → in_progress → closed. Features include statutory due-date calculation with business-day math, public tokens for anonymous submission and status tracking, and comment / attachment management.

**Key file:** `n8drive/apps/puddlejumper/src/engine/prrStore.ts`

---

## 18. Deep + Shallow Health Checks

Two separate health endpoints serve different consumers:

- **`/health`** — deep check: database connectivity, volume mount, secret presence
- **`/ready`** — shallow check: database ping only (fast, suitable for load balancers)

Fly.io is configured with `min_machines_running = 1` to prevent cold starts.

**Key files:** `n8drive/apps/puddlejumper/src/api/server.ts`, `n8drive/fly.toml`

---

## 19. Tenebrux Veritas — Deployment Engine with Hard Stops

The `live-edit-deploy-console` implements a deployment operator with built-in safety:

- **Governance diffs** — compare current vs. proposed state with warnings and blockers
- **Hard stop enforcement** — deployment blocked on incomplete checklists or stale diffs
- **Confirmation phrase** — human must type a specific phrase to proceed
- **Connection references** — secrets stored by reference only (`env://`, `keychain://`)
- **Veritas Memory** — append-only JSONL institutional knowledge log
- **Hash-chained deploy log** — tamper-evident audit trail

**Key files:** `live-edit-deploy-console/server/`, `live-edit-deploy-console/README.md`

---

## 20. Chamber Connect — SLA-Governed Case Management

A case management prototype with:

- **Routing rules engine** — configuration-driven case assignment (`routing_rules.json`)
- **Business hours awareness** — SLA calculations respect operating schedules
- **Public status portal** — citizens look up case status by token
- **Municipality taxonomy** — configurable municipalities and service categories

**Key files:** `chamber-connect/server.js`, `chamber-connect/config/routing_rules.json`

---

## 21. Playbook Sync with Drift Detection

Three directories hold playbook content and must stay in sync. A single script (`sync-playbooks.sh`) copies from the canonical source, and a `--check` flag enables CI-friendly drift detection (exits non-zero if copies diverge).

**Key file:** `scripts/sync-playbooks.sh`

---

## 22. SQLite Durability Pragmas (Standardized)

Every SQLite store in the system applies the same three durability pragmas:

```sql
journal_mode = WAL
synchronous = NORMAL
wal_autocheckpoint = 1000
```

This ensures consistent crash-safety guarantees across all data stores without per-store configuration drift.

**Key files:** `approvalStore.ts`, `idempotencyStore.ts`, `workspaceStore.ts`, `refresh-store.ts`

---

## 23. Charter Validation

Workspaces must have a charter with four boolean pillars — **authority**, **accountability**, **boundary**, and **continuity** — all set to `true` before governed intents can execute. This maps directly to municipal governance requirements.

**Key file:** `n8drive/apps/puddlejumper/src/engine/validation.ts` (`validateCharter`)

---

## Summary

PuddleJumper's architecture is built around a few core principles:

| Principle | Expression |
|---|---|
| **Default deny** | Fail-closed governance engine |
| **Separation of concerns** | Decision ↔ Dispatch ↔ Authority boundaries |
| **Immutability** | Append-only audit, hash-chained logs, CAS locks |
| **Config over code** | PolicyProvider swap, OAuth factory, tier limits |
| **Municipal compliance** | Retention schedules, M.G.L. citations, PRR workflows |
| **Defense in depth** | SSRF blocklist, injection detection, CSRF headers, token replay detection |
