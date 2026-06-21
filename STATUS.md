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
| 3  | PRR state names are statutory: received→…→closed.                       | LIVE    | Canon state machine at `apps/puddlejumper/src/domains/prr/prr.machine.ts` enforces the seven states 1:1 with a closed transition table; store/routes drive it. Supersedes legacy `apps/puddlejumper/src/prr/store.ts`. |
| 4  | No "wren" anywhere in code.                                             | LIVE    | `ship.sh` word-boundary sweep clean (only false-positive substring is "Lawrence"). |
| 5  | No `@vercel/kv` anywhere.                                               | LIVE    | `ship.sh` sweep clean. |
| 6  | SYNCHRON8 is PJ-native. Not n8n / BullMQ.                               | PARTIAL | `apps/puddlejumper/src/syncronate/*` is PJ-native; no n8n / BullMQ deps. Intent dispatch not yet wired. |
| 7  | AI assists, never decides. Every AI suggestion → human approval.        | SPEC    | Puddles chat is built but the structured-suggestion + confirmation-card gate is Phase 9 work. |
| 8  | Tenant binding on every query. No cross-tenant leakage.                 | PARTIAL | `getAuthContext()` returns `tenantId`; most stores scope by it. Audit needed (Phase 2). |
| 9  | Split-Row Runtime Contract holds. Canon invariant; overlays declare.    | LIVE    | `@pj/split-row` provides the boot lint gate + framework registry. Phillipston reference overlay lints clean. Manifest signing (Ed25519) supported. Shared binding registry immutable by DB trigger. |
| 10 | The "stuff" doesn't matter — PJ emits intents, adapters handle tools.   | SPEC    | Canon types defined (`types/integration.ts`); SYNCHRON8 dispatch is Phase 6. |

## Packages

| Package                  | Spec name        | Status  | Notes |
|--------------------------|------------------|---------|-------|
| `@publiclogic/core`      | `@pj/core`       | PARTIAL | Auth/JWT/cookie/middleware LIVE. Canon types added in Phase 0 (`src/types/*`). Package name still `@publiclogic/*` — rename is a Phase 1+ decision. |
| `@publiclogic/vault`     | `@pj/vault`      | PARTIAL | Exists as a separate Fly service. No `evaluate()` export against canon `VaultContext`. |
| `@pj/db`                 | `@pj/db`         | LIVE    | Phase 1: SQLite layer at `packages/db/`. Exports `getDb`, `migrate`, `appendAuditEvent`, `verifyAuditTriggers`. Ships canon migrations `001..003` under `packages/db/migrations/`. 8/8 tests pass (canon triggers refuse UPDATE+DELETE; verifier reports both triggers; migrate idempotent). Existing `apps/logic-commons` multi-DB runner is unchanged and continues to serve the live production DBs. |
| `@pj/org-manager`        | `@pj/org-manager`| LIVE    | Phase 3: `packages/org-manager/`. Exports `whois`, `can`, `assign` (named_default / round_robin / lookup_table), `deactivateIdentity`. Hardcoded `DEFAULT_PERMISSIONS` per the 8 canon role types; every `can()` appends `auth.granted`/`auth.refused` via `appendAuditEvent`. 9/9 tests pass. Legacy `apps/puddlejumper/src/org-manager/*` left in place (dead code, do not extend). |
| —                        | `@pj/formkey`    | PARTIAL | Lives at `apps/puddlejumper/src/formkey/*`. No package extraction. |
| —                        | `@pj/synchron8`  | PARTIAL | Lives at `apps/puddlejumper/src/syncronate/*` (PJ-native). Intent dispatch not yet wired. |
| —                        | `@pj/archieve`   | PARTIAL | Lives at `apps/puddlejumper/src/archieve/*`. Retention enforcement skeletal. |
| —                        | `@pj/cal`        | SPEC    | Not extracted; CAL v1 spec exists separately. |
| —                        | `@pj/mcp`        | LIVE    | `apps/puddlejumper/src/api/mcp.ts` exposes the MCP tool server. |
| `@pj/ui`                 | `@pj/ui`         | LIVE    | Phase 5: `packages/ui/`. Exports `tokens.css` (canonical CSS variables from Spec Part 7) and `TOKENS` typed map. `apps/web/app/globals.css` imports `tokens.css` and mirrors values in its Tailwind v4 `@theme` block. |

## Apps

| App                  | Status  | Notes |
|----------------------|---------|-------|
| `apps/puddlejumper`  | LIVE    | Express 5 backend, deployed to Fly.io at `api.publiclogic.org`. 35 route files under `src/api/routes/`. |
| `apps/logic-commons` | LIVE    | Shared auth/audit/migrations library consumed by `puddlejumper`. |
| `apps/logicos`       | RETIRE  | React frontend being replaced. Per spec it is retiring. |
| `apps/web`           | LIVE    | Phase 5: Next.js 15 + React 19 + TS + Tailwind v4 (PostCSS plugin). Marketing landing at `app/(marketing)/page.tsx`, platform shell at `app/(platform)/layout.tsx` with Rail (48) + Sidebar (196) + Canvas (1fr) + Detail (340) per Spec Part 8. Dashboard at `app/(platform)/dashboard/page.tsx` renders PRR list + detail panel from mock data shaped to canon `Process` type. Design tokens in `app/globals.css` `@theme` block per Spec Part 7. Fonts: Cormorant Garamond / DM Sans / JetBrains Mono via `next/font`. Build prerenders both routes; typecheck + build clean in ship gate. No live API wiring yet — UI-only scaffold. |
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
| `packages/db/src/db.ts`                     | LIVE    | Phase 1 |
| `packages/db/src/audit.ts`                  | LIVE    | Phase 1 |
| `packages/db/migrations/{001,002,003}.sql`  | LIVE    | Phase 1 — runtime copy of canon set |
| `packages/db/test/db.test.ts`               | LIVE    | Phase 1 — 8/8 passing |
| `apps/puddlejumper/src/domains/prr/`        | LIVE    | Phase 2 — machine + store + routes (canon) |
| `apps/puddlejumper/src/routes/audit.routes.ts` | LIVE | Phase 2 — canon audit surface |
| `apps/puddlejumper/src/routes/audit.store.ts` | LIVE  | Phase 2 — tenant-scoped audit queries |
| `packages/org-manager/src/{index,permissions,errors}.ts` | LIVE | Phase 3 — whois / can / assign / deactivateIdentity |
| `packages/org-manager/test/org-manager.test.ts` | LIVE | Phase 3 — 9/9 passing |
| `apps/puddlejumper/src/routes/org.routes.ts` | LIVE  | Phase 3 — org HTTP surface |
| `packages/split-row/src/{lint,registry,canonical-json,index}.ts` | LIVE | Phase 4 — lint + registry + manifest signing |
| `packages/split-row/test/lint.test.ts` | LIVE | Phase 4 — 9/9 passing |
| `packages/db/migrations/{004,005}.sql` | LIVE | Phase 4 — shared_bindings + deployment history |
| `pj/overlays/phillipston/divergence_manifest.yaml` | LIVE | Phase 4 — reference overlay, lint-clean |
| `apps/puddlejumper/src/routes/overlay.routes.ts` | LIVE | Phase 4 — shared binding registry CRUD |

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
| 1     | Database + audit     | DONE          | `@pj/db` extracted to `packages/db/`. WAL + foreign_keys on every connection. Canon triggers verified by `verifyAuditTriggers()` and proven append-only by tests. 8/8 tests pass. |
| 2     | Core objects         | DONE          | Canon PRR domain at `apps/puddlejumper/src/domains/prr/` (machine + store + routes). Canon audit stream at `apps/puddlejumper/src/routes/audit.routes.ts`. Replaces legacy `routes/prr.ts` and `admin.ts` /audit endpoints. 19/19 new domain tests pass; statutory state machine enforced; every transition appends to `audit_events` via `appendAuditEvent`. |
| 3     | Org Manager          | DONE          | `@pj/org-manager` extracted to `packages/org-manager/`. `whois` / `can` / `assign` / `deactivateIdentity` with `auth.granted`/`auth.refused` + `role.assigned`/`role.deactivated` emission. Canon PRR `PATCH /:id/state` now gated by `can()` (403 `auth.refused` when denied). `POST /api/org/can` and CRUD on `/api/org/identities` mounted. 9/9 package tests pass. |
| 4     | Split-Row + overlay  | DONE          | `@pj/split-row` at `packages/split-row/`: 8-check lint (collects all failures, never short-circuits) + framework registry (in-memory cache, `divergence.manifest_loaded` / `divergence.manifest_changed` / `divergence.binding_exercised` / `divergence.lint_failed`). Ed25519 manifest signing supported (Part 14 RESOLVED-1). Migration 004 adds `shared_bindings` with the canon `shared_bindings_no_content_update` immutability trigger; migration 005 rebuilds `deployment_manifests` with history (partial unique index for one CURRENT per deployment, prior rows flip to SUPERSEDED per RESOLVED-3). Phillipston reference overlay at `pj/overlays/phillipston/` lints clean. Boot integration in `server.ts`: `OVERLAY_DIR` env var triggers `loadOverlay`; lint failure logs and exits 1. `/api/overlays/bindings` CRUD (admin-only) wired. 9/9 split-row tests pass + 3 new `@pj/db` trigger tests. |
| 5     | Platform UI          | DONE          | `apps/web` (Next.js 15 / React 19 / Tailwind v4) shipped: server-rendered dashboard page with `'use client'` PlatformShell holding Rail / Sidebar / Canvas / DetailPanel + TemplateModal. `lib/api.ts` is the only fetch surface — cookie-first auth (`credentials: 'include'`), `X-PuddleJumper-Request: true` on every mutating verb, never Bearer from the browser, `NEXT_PUBLIC_API_BASE_URL` with dev/prod defaults. Dashboard wires `GET /api/prr` for list, `GET /api/prr/:id` for detail, `GET /api/audit/:id` for the real audit feed, `PATCH /api/prr/:id/state` for step advance, `POST /api/prr/:id/close` for close, `PATCH /api/prr/:id/fields` for checklist toggle, `POST /api/prr` for create-from-template. Filter bar (All / Campaign / PublicLogic / Personal) filters client-side from the in-memory list — no second API call per filter. Both `/` and `/dashboard` statically prerender. Tokens extracted to `@pj/ui`. |
| 5.1   | PATCH fields gap     | DONE          | `PATCH /api/prr/:id/fields` wired in canon PRR domain. Allowlist via Zod `.strict()` (checklist / notes / automation only; unknown keys → 400, empty patch → 400 with `fields.empty_patch`). `updateFields()` computes diff, no-op patches return `changed: []` with zero audit noise, real diffs commit `process.fields_updated` (with before/after) in one tx with the UPDATE. `can(actor, 'process.update_fields', ...)` gates the route, 403 on refusal. Closed PRRs throw `PJFieldsClosed` → 409. 11 new tests (5 schema + 6 store) + 6 route-level tests via supertest with stubbed `req.auth`. Closes the checklist-toggle optimistic-rollback gap from Phase 5. |
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
| `turbo test` (excl. RETIRE)        | PASS   | whole-monorepo suite green (16/16 test tasks) — see resolved section below |

`@gpr/logicos` is RETIRE per spec and is filtered out of all three turbo
runs (matching the existing `pnpm run ci` script).

### Pre-existing test failures — RESOLVED

The four test files previously tolerated by `scripts/ship.sh` are now fixed,
and CI (`pnpm run ci`) runs `turbo run … test`, so a red suite blocks merges.

1. **`packages/core/test/auth.test.ts`** — added the missing `supertest` +
   `@types/supertest` devDependencies to `packages/core/package.json`.

2. **`apps/logic-commons/bin/migrate.test.ts`** — `migrate.mjs` had a
   TypeScript return annotation in a `.mjs` file (invalid JS) and imported
   `dotenv` without declaring it; both fixed. The CLI now calls the
   migrations module through its namespace (not a destructured binding) and
   the test aligns its specifier + uses `clearAllMocks` so describe-scoped
   spies survive past the first test.

3. **`apps/puddlejumper/src/api/migrations.test.ts`** & **4. `tier-enforcement.test.ts`**
   — the audit-store module-level singleton (`_db` / `_dataDir` in
   `apps/logic-commons/src/lib/audit-store.ts`) leaked across test files.
   Fixed two ways: `configureAuditStore()` now closes the cached handle when
   the data dir changes, and the app vitest config isolates each test file in
   its own forked process. Full app suite: 674 passed; whole monorepo: green.

## Resolved decisions (formerly open)

All five questions in spec Part 14 are resolved and locked. See spec
sections RESOLVED-1 through RESOLVED-5.

## Deploy state

| Item              | State                                                                                                                                                          |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Merge commit      | `2e3bef8` — `merge: phases 4 + 5 + 5.1 — overlay, platform UI, fields-patch`                                                                                   |
| Branch deletion   | `claude/funny-sagan-V2hbG` deleted post-merge                                                                                                                  |
| Ship gate on main | **10 pass / 1 warn / 0 fail** post-merge; web prerenders both routes; canon PRR 36/36                                                                          |
| Fly deploy        | **Not run from this session.** Container has no `fly` CLI and no network to `api.publiclogic.org`. Operator must run `fly deploy --app publiclogic-puddlejumper` from their machine, then smoke `/health` + `GET /api/prr`. |
| Vercel deploy     | **Not verified from this session.** Sandbox git remote is a local proxy (`http://127.0.0.1:.../git/...`), not GitHub, so the merge push does not trigger Vercel auto-deploy. Operator must push `main` to the real GitHub remote (or open in Vercel) to trigger the build. |

### Operational — seed

Seed at `apps/puddlejumper/seed/`. YAML-driven (`people.yaml`),
idempotent, audit-emitting. Adds Nate + Allie as administrators under
the `publiclogic` tenant. Run via
`pnpm --filter @publiclogic/puddlejumper seed`. Adding a person is a
one-line YAML edit + re-run.

- New canon migration: `006_identity_overlay.sql` adds `email`,
  `display_name`, and `oauth_subjects` columns to `identities` with a
  partial unique index on `(tenant_id, email) WHERE email IS NOT NULL`.
- New store exports in `@pj/org-manager`: `createTenant`,
  `createIdentity` (both idempotent, scoped by `(tenant_id, email)` for
  identities).
- Seed emits `tenant.seeded`, `identity.seeded`, `role.seeded`, and the
  usual `process.created` events through `appendAuditEvent`. No raw SQL.
- Role mutations via YAML are refused with a `WARN`; deactivation is not
  a seed concern — use `PATCH /api/org/identities/:id/deactivate`.
- 5 seed tests cover: fresh DB, idempotent re-run, new identity append,
  role-change WARN, invalid-YAML rollback. Manual CLI smoke confirmed:
  first run creates everything, second run shows `[existing]` across
  the board.

**Open follow-up:** the `onUserAuthenticated` hook in
`apps/puddlejumper/src/api/server.ts` does NOT look up canon
`identities` by `(tenant_id, email)`. Email + display_name now exist on
the canon identity row, but bridging that to OAuth login is
intentionally deferred — flagged in `seed/README.md`. Until it lands,
logging in via Google as `nate@publiclogic.org` will not attach the
seeded canon identity to the session; it uses the legacy `workspace`
row path.

### Carryovers

Two open items the merge did not close — neither blocks deploy:

1. **`pj-single-v2.html` + `TMPLS` recovery.** Phase 5 honored the
   class-name vocabulary the prompt cites (`sb-item`, `cv-top`, `pc`,
   `det-head`) but built visuals from Spec Part 7 tokens directly. The
   9 templates in `apps/web/lib/templates.ts` and the 5 automation
   options are reasonable fillers, not the originals. Swap when the
   real `TMPLS` is in hand.
2. **Cross-tenant 403-vs-404 precedence not yet in CANON.md.** Phase
   3 / 5.1 settled on "`can()` gates before existence reveal" (so
   cross-tenant returns 403 `auth.refused`, not 404). Documented in
   `prr.routes.test.ts`; lift into the canon doc once it lands.
