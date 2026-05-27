# PuddleJumper — Build Status

Live/spec inventory against **Master Build Spec v1.1, May 2026**.
Captured during Phase 0 (Consolidation). Update on every phase boundary.

Legend:

- LIVE — deployed and working in production
- PARTIAL — exists in repo but incomplete, drifted from canon, or not wired up
- SPEC — specified in canon, not yet built
- RETIRE — being removed; do not extend

## Canon rules (Master Spec, top of doc)

| #  | Rule                                                                    | Status  | Evidence |
|----|-------------------------------------------------------------------------|---------|----------|
| 1  | SQLite + better-sqlite3, WAL mode. No Postgres / Redis / managed DB.    | LIVE    | `apps/puddlejumper/src/api/migrations.ts` opens DBs with `journal_mode = WAL`. `ship.sh` blocks banned deps. |
| 2  | `audit_events` is append-only. SQLite triggers enforce.                 | LIVE    | Both triggers defined in `apps/logic-commons/src/lib/audit-store.ts` and in `pj/canon/migrations/001_schema_init.sql`. `ship.sh` verifies. |
| 3  | PRR state names are statutory: received→…→closed.                       | PARTIAL | PRR storage exists (`apps/puddlejumper/src/prr/store.ts`); state machine in code does not yet line up 1:1 with the seven canon states. |
| 4  | No "wren" anywhere in code.                                             | LIVE    | `ship.sh` word-boundary sweep clean (only false-positive substring is "Lawrence"). |
| 5  | No `@vercel/kv` anywhere.                                               | LIVE    | `ship.sh` sweep clean. |
| 6  | SYNCHRON8 is PJ-native. Not n8n / BullMQ.                               | PARTIAL | `apps/puddlejumper/src/syncronate/*` is PJ-native; no n8n / BullMQ deps. Intent dispatch not yet wired. |
| 7  | AI assists, never decides. Every AI suggestion → human approval.        | SPEC    | Puddles chat is built but the structured-suggestion + confirmation-card gate is Phase 9 work. |
| 8  | Tenant binding on every query. No cross-tenant leakage.                 | PARTIAL | `getAuthContext()` returns `tenantId`; most stores scope by it. Audit needed (Phase 2). |
| 9  | Split-Row Runtime Contract holds. Canon invariant; overlays declare.    | SPEC    | Canon types live in `@publiclogic/core` (`types/divergence.ts`); lint + registry are Phase 4. |
| 10 | The "stuff" doesn't matter — PJ emits intents, adapters handle tools.   | SPEC    | Canon types defined (`types/integration.ts`); SYNCHRON8 dispatch is Phase 6. |

## Packages

| Package                  | Spec name        | Status  | Notes |
|--------------------------|------------------|---------|-------|
| `@publiclogic/core`      | `@pj/core`       | PARTIAL | Auth/JWT/cookie/middleware LIVE. Canon types added in Phase 0 (`src/types/*`). Package name still `@publiclogic/*` — rename is a Phase 1+ decision. |
| `@publiclogic/vault`     | `@pj/vault`      | PARTIAL | Exists as a separate Fly service. No `evaluate()` export against canon `VaultContext`. |
| —                        | `@pj/db`         | SPEC    | Migration code lives in `apps/logic-commons/src/lib/migrations.ts` (multi-DB, dated filenames). No standalone `@pj/db` package yet. |
| —                        | `@pj/org-manager`| PARTIAL | Lives at `apps/puddlejumper/src/org-manager/*`. No package extraction. `whois/can/assign` surfaces unclear vs canon. |
| —                        | `@pj/formkey`    | PARTIAL | Lives at `apps/puddlejumper/src/formkey/*`. No package extraction. |
| —                        | `@pj/synchron8`  | PARTIAL | Lives at `apps/puddlejumper/src/syncronate/*` (PJ-native). Intent dispatch not yet wired. |
| —                        | `@pj/archieve`   | PARTIAL | Lives at `apps/puddlejumper/src/archieve/*`. Retention enforcement skeletal. |
| —                        | `@pj/cal`        | SPEC    | Not extracted; CAL v1 spec exists separately. |
| —                        | `@pj/mcp`        | LIVE    | `apps/puddlejumper/src/api/mcp.ts` exposes the MCP tool server. |
| —                        | `@pj/ui`         | SPEC    | UI tokens locked in `pj-single-v2.html` reference; not extracted to a package. |

## Apps

| App                  | Status  | Notes |
|----------------------|---------|-------|
| `apps/puddlejumper`  | LIVE    | Express 5 backend, deployed to Fly.io at `api.publiclogic.org`. 35 route files under `src/api/routes/`. |
| `apps/logic-commons` | LIVE    | Shared auth/audit/migrations library consumed by `puddlejumper`. |
| `apps/logicos`       | RETIRE  | React frontend being replaced. Per spec it is retiring. |
| —                    | SPEC    | `apps/web` (Next.js 15 marketing + platform) — not yet scaffolded. |
| —                    | SPEC    | `apps/puddles` (AI chat) — Puddles MCP plumbing exists in puddlejumper backend; standalone Next route not present. |

## Canon artifacts (Phase 0 output)

| Artifact                                    | Status  |
|---------------------------------------------|---------|
| `scripts/ship.sh`                           | LIVE    |
| `pj/canon/migrations/001_schema_init.sql`   | LIVE    |
| `pj/canon/migrations/002_divergence.sql`    | LIVE    |
| `pj/canon/migrations/003_integration.sql`   | LIVE    |
| `pj/canon/migrations/README.md`             | LIVE    |
| `packages/core/src/types/process.ts`        | LIVE    |
| `packages/core/src/types/audit.ts`          | LIVE    |
| `packages/core/src/types/identity.ts`       | LIVE    |
| `packages/core/src/types/divergence.ts`     | LIVE    |
| `packages/core/src/types/integration.ts`    | LIVE    |
| `packages/core/src/types/response.ts`       | LIVE    |
| `STATUS.md` (this file)                     | LIVE    |

Spec canon-reference artifacts that are **still missing** (deferred to later phases):

- `pj/canon/process-object.schema.json`
- `pj/canon/audit-events.schema.sql` (subsumed for now by `pj/canon/migrations/001_schema_init.sql`)
- `pj/canon/state-machine.grammar.md`
- `pj/canon/org-manager.contract.md`
- `pj/canon/split-row-runtime-contract.md`
- `pj/overlays/phillipston/*` (reference overlay)
- `pj/runtime/frameworkRegistry.ts`, `splitRowLint.ts`, `auditEvents.ts`

## Phase status

| Phase | Title                | Status        | Notes |
|-------|----------------------|---------------|-------|
| 0     | Consolidation        | DONE          | ship.sh + canon migrations + core types + STATUS.md + full inventory complete. Canon gate 10/10; one pre-existing test failure inventoried. |
| 1     | Database + audit     | NOT STARTED   | `@pj/db` package not extracted. Live audit triggers already exist. |
| 2     | Core objects         | NOT STARTED   | Process CRUD + canon state-machine wiring. |
| 3     | Org Manager          | NOT STARTED   | `whois/can/assign` canon surfaces. |
| 4     | Split-Row + overlay  | NOT STARTED   | Lint + manifest loader. |
| 5     | Platform UI          | NOT STARTED   | Port `pj-single-v2.html` to React; depends on `apps/web` scaffold. |
| 6     | Integration layer    | NOT STARTED   | SYNCHRON8 intent dispatch + adapter webhooks. |
| 7     | Double               | NOT STARTED   | Two-person shared workspace. |
| 8     | Teams                | NOT STARTED   | Role-enforced multi-user. |
| 9     | Puddles + MCP gate   | NOT STARTED   | AI human-approval card; MCP tools already live (Rule 7 enforcement is the gap). |

## TypeScript / test / build state

Captured by `PJ_SHIP_SOFT_TYPECHECK=1 ./scripts/ship.sh` after Phase 0.

| Check                              | Result | Notes |
|------------------------------------|--------|-------|
| Canon rule 4 — no 'wren'           | PASS   |       |
| Canon rule 5 — no @vercel/kv       | PASS   |       |
| Banned deps                        | PASS   |       |
| Canon migration set present        | PASS   | 001 / 002 / 003 in `pj/canon/migrations/` |
| Canon rule 2 — audit triggers      | PASS   | defined in `apps/logic-commons/src/lib/audit-store.ts` |
| STATUS.md present                  | PASS   |       |
| `turbo typecheck` (excl. RETIRE)   | PASS   | 4 packages clean (`@publiclogic/core`, `@publiclogic/vault`, `@publiclogic/logic-commons`, `@publiclogic/puddlejumper`) |
| `turbo build` (excl. RETIRE)       | PASS   | same 4 packages build cleanly |
| `turbo test` (excl. RETIRE)        | FAIL   | one pre-existing failure — see below |

`@gpr/logicos` is RETIRE per spec and is filtered out of all three turbo
runs (matching the existing `pnpm run ci` script).

### Pre-existing test failure — not Phase 0 scope

`packages/core/test/auth.test.ts` imports `supertest` but the dep is missing
from `packages/core/package.json` (it is declared in `apps/puddlejumper` and
`apps/logic-commons`). Vitest reports:

```
FAIL  test/auth.test.ts
Error: Failed to load url supertest (resolved id: supertest) in
       /home/user/puddlejumper/packages/core/test/auth.test.ts
```

The fix is to add `supertest` + `@types/supertest` to `packages/core`
devDependencies. Spec Phase 0.1 limits the "obvious" fix list to wren and
@vercel/kv, so this is inventoried here and deferred to a follow-up cleanup
(could land alongside Phase 1 `@pj/db` work, when `@publiclogic/core` is
already being touched).

## Resolved decisions (formerly open)

All five questions in spec Part 14 are resolved and locked. See spec
sections RESOLVED-1 through RESOLVED-5.
