# PuddleJumper V1 C0 Diagnosis

> Diagnosis-only pass for Issue #99. No code changed except this report.
> Classification legend: LIVE (code confirms, working) / PARTIAL (code exists,
> incomplete or not wired to the V1 spine) / SPEC (named in canon, no code) /
> DEAD (legacy, do not extend) / UNKNOWN. Architecture docs (STATUS.md, spec)
> were treated as claims and verified against code before any LIVE call.

## Executive Finding

- **Proceed to C1 pipeline skeleton: YES**
- The architecture lock is genuinely enforced (ship.sh canon gate passes 8/8;
  SQLite/WAL is universal; no banned tech), and every substrate C1 needs to walk
  one seeded input down the spine already exists as real code: a single canonical
  append-only audit writer (`appendAuditEvent` in `@pj/db`), a migration runner,
  a central auth context, a FormKey intake/output engine, and a governance engine.
  The missing pieces — the V1 tables (`rule_packs`, `holds`, `incoming_items`,
  `output_templates`, `generated_outputs`, `case_space_action_state`, connector
  grants) and the three executable packs — are exactly the C2–C10 scope, not C1
  blockers. C1 can stub the full spine and write one Recordstream entry today.

## Architecture Lock Check

| Check | Status | Evidence | Notes |
|---|---|---|---|
| SQLite + WAL only | LIVE | `packages/db/src/db.ts:50` `db.pragma('journal_mode = WAL')`; 80+ WAL pragmas across stores; `better-sqlite3` in every package.json | Enforced broadly, not just claimed |
| No Postgres / Redis / Mongo / n8n / BullMQ deps | LIVE | `ship.sh --canon-only` "no banned database/queue deps"; no `pg`/`redis`/`mongoose`/`mongodb`/`n8n`/`bullmq` keys in any package.json | — |
| No `@vercel/kv` | LIVE | `ship.sh` sweep clean; `syncronate/kv-store.ts` is a SQLite table `syncronate_kv`, not Vercel KV | Name is misleading, tech is compliant |
| No "wren" | LIVE | `ship.sh` word-boundary grep clean (only substring near-miss is town name "Lawrence") | — |
| No external queues | LIVE | `archieve/queue.ts` and `syncronate/job-store.ts` are SQLite/WAL-backed (`better-sqlite3`), not BullMQ/Redis | "queue" naming is internal WAL queue only |
| Synchronous pipeline | SPEC | No single end-to-end pipeline service exists; `engine/governanceEngine.ts` is the closest orchestrator | C1 builds the synchronous spine |
| Every meaningful branch writes Recordstream/proof | PARTIAL | `appendAuditEvent()` (`packages/db/src/audit.ts`) is the sole writer, widely called (PRR, FormKey, archieve, org-manager). The literal term **"recordstream" appears nowhere in code** — it is realized as `audit_events`. | Pipeline-wide branch-proof not yet wired; per-domain proof is |
| ship.sh release gate | LIVE | `scripts/ship.sh`; canon-only run = 8 pass / 0 warn / 0 fail | Full gate also runs turbo typecheck/test/build |
| Auth = Apple / Google / Microsoft only | PARTIAL | OAuth providers in `apps/logic-commons/src/`: Google ✓, Microsoft ✓, **GitHub present (outside lock)**, **Apple absent**. Proxies: `googleProxy.ts`, `microsoftProxy.ts`, `githubProxy.ts`. "apple" only appears in `packages/core/src/types/integration.ts` (connector type). | Not a C1 blocker; V1 must add Apple and decide GitHub's fate |

## Component Inventory

| Component | Status | Path(s) | Evidence | V1 Reuse | Avoid / Risk |
|---|---|---|---|---|---|
| @pj/db | LIVE | `packages/db/` | `getDb`, `migrate`, `verifyAuditTriggers`, `appendAuditEvent`; `src/db.ts:50` WAL; 8/8 tests | Canonical DB + audit writer for the whole pipeline | Don't fork a second DB layer |
| Audit / Recordstream | LIVE (audit) / SPEC (the name) | `packages/db/src/audit.ts`, `apps/logic-commons/src/lib/audit-store.ts`, `apps/puddlejumper/src/routes/audit.routes.ts` + `audit.store.ts` | Append-only triggers `audit_events_no_update/_no_delete` in `001_schema_init.sql`; **no "recordstream" token in code** | Use `appendAuditEvent` as the Recordstream primitive | `apps/logic-commons` audit-store uses a module-level singleton (`_db`/`_dataDir`) — source of 4 inventoried test flakes; don't entangle pipeline with it |
| Org Manager | LIVE | `packages/org-manager/` | `whois`, `can`, `assign`, `deactivateIdentity`, `createTenant`, `createIdentity`; 9/9 tests; every `can()` emits `auth.granted/refused` | ACCESS GATE step → call `can()` | `apps/puddlejumper/src/org-manager/` is legacy dead code — do not extend |
| Split-Row / overlays | LIVE | `packages/split-row/`, `pj/overlays/phillipston/` | `splitRowLint`, `loadOverlay`, Ed25519 signing; migration 004 immutable `shared_bindings`; 9/9 tests | Overlay/divergence model for per-tenant rule packs | — |
| FormKey | PARTIAL | `apps/puddlejumper/src/formkey/` (`intake/`, `output/`, `consent/`, `registry/`) | `IntakeRecord`, `GovernanceEnvelope`, `ConsentRecord`, `resolveFieldPath`, `createFormKeyApiRouter`; `output/renderer.ts` renders templates | Reuse intake pipeline + output renderer for FORMKEY INTAKE / OUTPUT steps | Not extracted to `@pj/formkey`; outputs not persisted to a table |
| VAULT | PARTIAL | `packages/vault/` (separate Fly service) | `server.ts` on :3003, `policyProvider.ts`, `manifestRegistry.ts`, SQLite `manifests.db`/`audit.db`; **no canon `evaluate(VaultContext)` export** | Manifest/policy patterns reference | Reached over HTTP, not a module import; do not assume in-process `evaluate()` exists |
| ARCHIEVE / retention | PARTIAL | `apps/puddlejumper/src/archieve/` | `retention-enforcer.ts`, `chain.ts`, `tsa-client.ts`, `event-catalog.ts`, WAL `queue.ts`; retention/holds are **in-memory Maps** (`retention.ts`) | RETENTION/ARCHIEVE step skeleton + event catalog | Retention floors & legal holds are not persisted — V1 needs DB-backed `holds` |
| SYNCHRON8 / syncronate | PARTIAL | `apps/puddlejumper/src/syncronate/`, `apps/puddlejumper/src/civic/synchron8/flowExecutor.ts` | `sync-engine.ts`, `connectors/`, `sinks/`, `dlp-engine.ts`; PJ-native (no n8n/BullMQ); `intent_queue` table exists | INSTALLED TOOLS ACT step substrate | Intent dispatch not wired (Phase 6); optional for V1 spine |
| MCP / Puddles | LIVE (MCP) / SPEC (Puddles UI) | `apps/puddlejumper/src/api/mcp.ts` | JSON-RPC tool server, 20+ tools (`governance.prr_*`, `access.*`, `health.*`); `oauthMetadata` | Governed AI as optional CaseSpace tool over MCP | Rule-7 human-approval gate not built; standalone `apps/puddles` route absent |
| apps/web platform shell | LIVE (UI-only) | `apps/web/` | Next.js 15 / React 19 / Tailwind v4; Rail/Sidebar/Canvas/Detail; `lib/api.ts` single fetch surface; both routes prerender | Shell to host C9 CaseSpace UI | Dashboard uses mock data; no live wiring yet — UI scaffold only |
| @pj/core | PARTIAL | `packages/core/` | `src/auth.ts` `getAuthContext`, JWT cookie/Bearer middleware; canon `src/types/*` (process, audit, identity, divergence, integration, response) | Central AUTH context + canon types | Package still named `@publiclogic/core`; no Apple/provider-specific logic here |
| @pj/ui | LIVE | `packages/ui/` | `tokens.css` + typed `TOKENS` | Design tokens for C9 | — |
| LogicCommons (`apps/logic-commons`) | LIVE | `apps/logic-commons/` | OAuth factory, session, audit store, migration runner; consumed by puddlejumper + web | Auth/audit/migration plumbing | Singleton audit-store flakiness (above) |
| apps/logicos (`@gpr/logicos`) | DEAD (RETIRE) | `apps/logicos/` | React 18 SPA; filtered from all turbo runs via `--filter=!@gpr/logicos` | Concepts only (Capture/New Item) | Do not extend; being replaced by `apps/web` |
| logicbridge | PARTIAL/LIVE | `apps/puddlejumper/src/logicbridge/` (`explorer/`, `registry/`, `simulation/`, `spark/`) | `definition-store.ts`, `api.ts`, routes `GET /api/logicbridge` | Connector Registry / API Explorer substrate for connector grants | — |

## Existing Schema Inventory

| Area | Existing Path/Table | Status | Notes |
|---|---|---|---|
| Audit events | `audit_events` (`pj/canon/migrations/001_schema_init.sql`; runtime copy `packages/db/migrations/001.sql`) | LIVE | Append-only triggers; JSON indexes incl. `case_space_id` via `migrations/20260524_relay_v1_audit_json_indexes.sql` |
| Processes / PRR | `processes` (canon 001); legacy `prr` (`apps/puddlejumper/src/api/migrations.ts`, `+public_id` via `20260206`) | LIVE / legacy | Canon `domains/prr/` is current; legacy `prr/` + `prr` table are superseded |
| Shared bindings | `shared_bindings` (canon 004) | LIVE | Immutable content trigger |
| Deployment manifests | `deployment_manifests` (canon 002/005) | LIVE | CURRENT/SUPERSEDED history |
| Org identities / roles | `identities` (canon 001 + 006), `assignments` (canon 001), `tenants` (canon 001) | LIVE | 8 canon role types; OAuth subjects on identities |
| FormKey records | in-code SQLite stores: `formkey/registry/definition-store.ts`, `consent/store.ts`, `intake/` | PARTIAL | No canon table; lives in app stores |
| VAULT records | `packages/vault` `manifests.db` / `audit.db`; `vault-pay/invoices.sql` | PARTIAL | Separate service DBs + a vault-pay invoices table |
| ARCHIEVE retention/catalog | in-memory (`archieve/retention.ts`), `event-catalog.ts`; WAL `queue.db` | PARTIAL | Not persisted to a retention/holds table |
| SYNCHRON8 runs/intents | `integration_manifests`, `intent_queue` (canon 003); `syncronate_kv`, feed/job/record stores | PARTIAL | Tables exist; dispatch unwired |
| Connector grants / source pointers | `apps/puddlejumper/src/api/connectorStore.ts` (in-memory SQLite) | PARTIAL | No shared canonical grants table |
| CaseSpace state | `casespaces` (`api/migrations.ts` + Relay V1 fields via `20260524_relay_v1_casespace_fields.sql`) | PARTIAL | Row-level status/responsible-actor fields; no action-state history table |

## Missing V1 Schema

| Needed Table | Already Exists? | Recommendation | Notes |
|---|---|---|---|
| `rule_packs` | No | Add in C2; resolve by tenant+module+environment (C3) | Closest today: in-memory `civicpulse/core/ruleSet.ts` — port concept, don't reuse table |
| `holds` | No (in-memory Map only) | Add in C2; make holds first-class & persistent | Resume at VAULT for the held action (C6) |
| `incoming_items` | No | Add in C2 | FormKey intake currently memory + consent store only |
| `output_templates` | No | Add in C2 | Today: in-memory registry + `templates/invoices/base-invoice.html` |
| `generated_outputs` | No | Add in C2 | Outputs rendered to memory/filesystem, not persisted |
| `case_space_action_state` | Partial (`casespaces` row fields) | Add a dedicated action-state table in C2 | Relay V1 fields give current-responsible only, no per-action state |
| connector grants / source pointers | Partial (`connectorStore.ts`) | Add canonical grants + source-pointer tables in C2 | Tie to authenticated user + tenant + CaseSpace |

## Existing Routes and Services

| Need | Candidate Path(s) | Status | Recommendation |
|---|---|---|---|
| Pipeline domain/service | `apps/puddlejumper/src/engine/governanceEngine.ts` | PARTIAL | Closest orchestrator; C1 should add a new synchronous pipeline module rather than overload this |
| FormKey intake | `apps/puddlejumper/src/formkey/intake/pipeline.ts`, `formkey/api.ts` | LIVE | Reuse for FORMKEY INTAKE step |
| FormKey output | `apps/puddlejumper/src/formkey/output/renderer.ts` + `binding-resolver.ts` | LIVE | Reuse for FORMKEY OUTPUT step; add persistence |
| API enrichment / source pointers | `apps/puddlejumper/src/api/routes/governance.ts`, `engine/connectors.ts` | PARTIAL | Build deterministic mock adapters in C4 |
| Rule pack resolver | `apps/puddlejumper/modules/civicpulse/core/ruleSet.ts`, `config/ruleSetVersioning.ts` | PARTIAL | Port logic to a DB-backed resolver in C3 |
| VAULT evaluation | `packages/vault/src/policyProvider.ts`, `apps/puddlejumper/src/engine/policyProvider.ts` | PARTIAL | Add canon `evaluate()` against `VaultContext` in C5 |
| Holds / approval resume | `apps/puddlejumper/src/engine/approvalStore.ts`, `escalationEngine.ts`, `archieve/retention.ts` | PARTIAL | Make holds persistent + `resolveHold` resumes at VAULT (C6) |
| Generated outputs | `apps/puddlejumper/src/formkey/output/renderer.ts` | PARTIAL | Persist to `generated_outputs` (C8) |
| Recordstream writes | `packages/db/src/audit.ts` `appendAuditEvent` | LIVE | Sole writer; thread through every pipeline branch |
| Retention attach | `apps/puddlejumper/src/archieve/retention-enforcer.ts` | PARTIAL | Persist retention class per output (C8) |
| Connector grants | `apps/puddlejumper/src/api/connectorStore.ts`, `logicbridge/registry/` | PARTIAL | Promote to canonical grants table + registry |
| Central auth context | `packages/core/src/auth.ts` `getAuthContext`; OAuth in `apps/logic-commons/src/lib/oauth.ts` | LIVE (Google/MS) | Add Apple; decide GitHub's status |

## LogicOS / LogicCommons Concepts to Port

| Concept | Source Path(s) | Status | Porting Recommendation |
|---|---|---|---|
| Incoming Items / + New Item | `apps/logicos/app/` (`Capture` type, `CaptureView`) | DEAD (RETIRE app) | Port concept to `incoming_items` + Capture surface; do not extend logicos |
| Source types (email/form/upload/scan/calendar/drive/finance/permitting/GIS/API/chat/voicemail/website/manual) | `apps/logicos/app/types.ts` (`source: string`, not enum) | SPEC/PARTIAL | Define a canonical source-type enum in V1 |
| Doc classes (invoice/contract/minutes/agenda/permit/…/other) | `FEATURES.md`, `civicpulse/core/actionTypes.ts` (`CONTRACT_AWARD` only) | SPEC | No taxonomy exists; define in V1 classification |
| Confidence review (clear/low/unclassified) | none (only `VaultClassification` public/internal/…) | SPEC (no code) | Build fresh in New Item classification |
| Confirm / hold behavior | `civicpulse/approvalWorkflow/legalHoldQueue.ts` (`hold()`), `engine/approvalStore.ts` | PARTIAL | Port to first-class persistent `holds` |
| Retention visibility at intake | `FEATURES.md`, `ops/12-WEEK-NEXT-PHASE-PLAN.md` | SPEC/STUB | Surface retention class at intake (C2/C9) |
| Internal document/template output loop | `templates/invoices/base-invoice.html`, `formkey/output/renderer.ts` | PARTIAL | Generalize into `output_templates` + `generated_outputs` |
| LogicCommons / templates / library | `/home/user/LogicCommons/FOUNDATION_MOCKUP.md` (sibling repo, doc only) | SPEC | Keep as reusable library layer concept; no code to port |
| State View / LogicDash | logicos types (`LogicDashDeadline`, `LogicDashStats`) | DEAD/SPEC | Rebuild as "State View" in `apps/web`; vocabulary per Issue #99 |
| Connector Registry / API Explorer / LogicBridge | `apps/puddlejumper/src/logicbridge/` (live code) | PARTIAL/LIVE | Reuse logicbridge registry/explorer as Connector Registry substrate |

## V1 Triad Readiness

### guestops.stay

| Requirement | Exists? | Evidence | Gap |
|---|---|---|---|
| Input fixture (reservation) | Partial | `apps/puddlejumper/src/stayos/migrations.ts` (properties/reservations/devices/automations/messages tables) | No seeded `guestops.stay` reservation fixture for the pipeline |
| Module / environment names | Partial | `stayos/stayosRoutes.ts` routes `/api/stayos/*`; no `guestops.stay` pack id in code | No pack-naming abstraction |
| VAULT schema / rule pack | No | — | stayos has no VAULT/FormKey integration |
| Autonomy ceiling (`run_routine`) | No | automations are task-based, not policy-gated | Add ceiling from rule pack (C5) |
| Retention class (STAY-operations) | No | append-only audit table only | No retention class |
| Output template (Guest Arrival Brief) | No | `stayos_message_templates` exist (messages, not docs) | No output document |
| Hold behavior | No | — | Add per spec |
| Recordstream events | Partial | stayos audit table writes, but not via canon `appendAuditEvent`/event-catalog | Emit canon events |

### timedesk.muni

| Requirement | Exists? | Evidence | Gap |
|---|---|---|---|
| Input fixture (timesheet) | No | no `timedesk`/`timesheet`/`payroll` dir or string anywhere in repo | Build from scratch |
| Module / environment names | No | only a `'time'` entry in a logicos `ToolKey` enum (stub) | Build from scratch |
| VAULT schema / rule pack | No | — | Build |
| Autonomy ceiling (`suggest`) | No | — | Build |
| Retention class (statutory/payroll) | No | — | Build |
| Output template (Timesheet Review Summary) | No | — | Build |
| Hold behavior (approval for payroll/export) | No | — | Build |
| Recordstream events | No | — | Build |

### finance.biz

| Requirement | Exists? | Evidence | Gap |
|---|---|---|---|
| Input fixture (bank transaction) | Partial/wrong shape | `apps/puddlejumper/src/finance/store.ts` has `fiscal_years` + `financial_models` (fiscal modeling), not bank transactions; `vault-pay/invoices.sql` has invoices | No bank-transaction fixture |
| Module / environment names | Partial | `apps/puddlejumper/src/finance/` routes `/api/v1/finance` (admin-gated); no `finance.biz` pack id | No pack abstraction |
| VAULT schema / rule pack | No | — | Build |
| Autonomy ceiling (suggest/help_manage) | No | routes gated only by `requireToolAccess('admin')` | Build ceiling from pack |
| Retention class (business-finance/tax) | No | — | Build |
| Output template (Expense/Receipt Review Packet) | No | — | Build |
| Hold behavior (approval over threshold) | No | — | Build |
| Recordstream events | No | finance events not in `event-catalog.ts` | Build |
| No auto-money movement | OK (by absence) | no payment-execution path wired in finance store | Keep this invariant explicit in rule pack |

## Blockers

No C1 blockers found.

## Paths to Use

- `packages/db/` — `getDb`, `migrate`, `appendAuditEvent` (Recordstream primitive)
- `pj/canon/migrations/` — canon migration set (extend in C2; keep SQLite/WAL)
- `packages/core/src/auth.ts` — central `getAuthContext` (AUTH step)
- `packages/org-manager/` — `can()` for ACCESS GATE
- `apps/puddlejumper/src/formkey/intake/` and `formkey/output/` — FORMKEY INTAKE/OUTPUT
- `apps/puddlejumper/src/domains/prr/` — reference for a canon domain (machine + store + routes + tests)
- `apps/puddlejumper/src/archieve/` — RETENTION/ARCHIEVE skeleton + `event-catalog.ts`
- `apps/puddlejumper/src/logicbridge/` — Connector Registry / API Explorer substrate
- `apps/puddlejumper/src/stayos/`, `src/finance/` — partial substrate for guestops.stay / finance.biz
- `apps/web/` — shell to host C9 CaseSpace UI
- `scripts/ship.sh` — run on every implementation commit

## Paths to Avoid

- `apps/logicos/` (`@gpr/logicos`) — RETIRE; port concepts only, never extend
- `apps/puddlejumper/src/org-manager/` — legacy dead code (canon is `packages/org-manager/`)
- `apps/puddlejumper/src/prr/` + legacy `prr` table — superseded by `domains/prr/`
- `apps/puddlejumper/src/api/migrations.ts` legacy multi-DB runner & `apps/logic-commons` audit-store singleton — source of the 4 inventoried test flakes; don't entangle the V1 spine with module-level singleton state
- `/home/user/LogicCommons` and `/home/user/LogicOS` sibling repos — separate/legacy; reference concepts only

## Validation

Ran `./scripts/ship.sh --canon-only` (read-only canon checks; the full gate's
turbo typecheck/test/build is heavy and out of C0 scope). Result:
**8 pass / 0 warn / 0 fail — canon gate clean.** Checks: no "wren", no
`@vercel/kv`, no banned deps, canon migration set 001–003 present, audit
append-only triggers present, STATUS.md present. No unrelated failures were
touched.

## C1 Recommendation

Proceed to C1 pipeline skeleton: YES
