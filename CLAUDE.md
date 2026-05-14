# CLAUDE.md
# PuddleJumper — Claude Code Project Instructions

You are working on PuddleJumper, the first governance process runtime, built by PublicLogic LLC.

## Read these files first, every session

1. `README.md` — architecture, principles, product suite, deployment list
2. `packages/core/src/vault/index.ts` — VAULT framework types and doctrine
3. `packages/core/src/gpr/index.ts` — GPR interfaces, CaseSpace type, module list
4. `packages/core/src/audit/index.ts` — audit system, append-only rules
5. `packages/db/src/index.ts` — SQLite schema, triggers, the enforcement layer
6. `packages/sync8/src/index.ts` — cloud sync model, cost doctrine, artifact delivery
7. `packages/formkey/src/index.ts` — structured data ingestion
8. `scripts/ship.sh` — release gate, architecture lock

## Canon — non-negotiable

**GPR means Governance Process Runtime.** Never "engine." Runtime is a defended technical claim: PJ enforces conditions under which work can happen (authority, policy, audit) rather than executing the work itself. The runtime is the environment, not a feature.

**VAULT = Verification, Authority, Utility, Legitimacy, Transfer.** Written by Nathan Boudreau. Operationalized by Dr. Allison Weiss Rothschild. Do not attribute VAULT's authorship to Allison. She made it real. Nate wrote it.

**Transfer is the pass-back.** The T in VAULT is how governed artifacts leave the runtime and land in systems of record (SharePoint, Google Drive, CivicPlus) with a governance fingerprint attached.

**The product is PuddleJumper (PJ).** LogicOS is retired as a brand name. Everything is just PuddleJumper now.

**SQLite everywhere.** better-sqlite3, WAL mode. No Postgres. No managed database. No Redis. No queue service.

**Append-only audit.** audit_events cannot be UPDATEd or DELETEd. SQLite triggers enforce this. If you write a migration or schema change, the triggers must survive. Check `ship.sh` — it verifies trigger presence.

**AI assists, never decides.** Puddles can surface, summarize, recommend. Humans approve. Every AI-generated suggestion must route to a human for decision. The `ai_assist` actor type in audit events must always have `decisionMade: false`.

**Tenant binding on every query.** No cross-tenant data leakage. Every database query must be scoped to tenant_id. No exceptions.

**No "wren" anywhere.** Retired name. Must not appear in any new code. `ship.sh` sweeps for it.

**No @vercel/kv.** Migrated to SQLite. `ship.sh` sweeps for KV imports.

**SYNCHRON8 is PJ-native.** Not n8n. Not BullMQ. If you need automation or job scheduling, build it inside the sync8 package.

**// GPR** — the comment-style notation. Appears on the horizontal logo mark. Use it in file headers.

## Product suite — the module names

| Module | Package | What it does |
|--------|---------|-------------|
| VAULT | @pj/core | Governance evaluation framework |
| Formkey | @pj/formkey | Structured data ingestion — forms that create governed records |
| CAL | @pj/cal | Civic Automation Layer — deadlines, notices, meetings |
| ARCHIEVE | @pj/archieve | Retention enforcement — lifecycle constraints |
| SYNCHRON8 | @pj/sync8 | Automation + cloud sync + artifact delivery |
| Org Manager | @pj/org-manager | Runtime routing — resolves position, not roles |
| Puddles | apps/puddles | AI chat interface (Vercel AI SDK + Anthropic) |
| Formkey | @pj/formkey | Structured ingestion runtime |

## Architecture rules

- **Turborepo monorepo.** pnpm workspaces. Apps import packages, never the reverse.
- **Next.js 15** with app router, React 19, Tailwind v4 via @tailwindcss/postcss.
- **Route groups:** `(marketing)` = public pages with header/footer. `(platform)` = authenticated with sidebar.
- **Express 5** backend in apps/api. Existing PJ codebase slots into src/domains/ and src/routes/.
- **Types live in @pj/core.** Every other package imports from core. Don't duplicate type definitions.
- **Design tokens** are in `apps/web/app/globals.css` — navy governance palette, CSS custom properties.
- **Fonts:** Instrument Serif (display), DM Sans or Satoshi (body), JetBrains Mono (code/mono).

## Sync cost model — do not over-engineer

Outbound: push-on-transfer. One API call when VAULT Transfer completes. Event-driven.
Inbound: pull-on-casespace. Delta query on session open. One call. Token stored in SQLite.
Reconcile: SYNCHRON8 cron. Nightly batch.
No persistent connections. No webhook subscriptions. No polling infrastructure.
Microsoft Graph free tier: 10K calls/day. Google Drive: 12K/day. Municipal volume is nowhere near these limits.

## CaseSpace

The CaseSpace is the runtime context — the join of identity, position, tools, rules, deadlines, and institutional context. The type is in `packages/core/src/gpr/index.ts`. Every action happens inside a casespace. That's what makes PJ a runtime, not a tool collection.

## Active deployments (reference for test data and examples)

- Phillipston, MA — live, CivicPlus migration, PRR framework, FY26
- Sutton, MA — Community Compact IT grant, active
- Westminster, MA — Community Compact IT grant, active
- NEPM/AED Pocomoke — $10M+ NMTC biochar compliance

## When writing code

- Run `pnpm turbo typecheck` after changes to catch type errors early
- Run `pnpm ship` before committing — it's the release gate
- Keep components minimal. No emoji in UI unless the user explicitly asked for it.
- Write docstrings that explain WHY, not just what. The governance context matters.
- When generating UI, use the design tokens from globals.css. Don't invent colors.
- When creating database queries, always include tenant_id in the WHERE clause.
- When writing audit events, use the appendAuditEvent function from @pj/db. Never raw INSERT.

## Nate's communication style

Direct, terse, anti-corporate. Plain language. No "leverage," no "streamline," no "empower." If something is broken, say it's broken. If something works, say why. Write code comments the way a municipal practitioner talks, not the way a SaaS marketing page reads.

## The duck

The PuddleJumper mascot is a duck in a WWII fighter plane. Calm on the surface, governance machinery underneath. The horizontal logo has `// GPR` in comment-style notation. Logo files go in `apps/web/public/images/`.
