# 🦆 PuddleJumper

**The first governance process runtime.**

PuddleJumper sits between a decision and an action — evaluating authority, routing to the right person, and producing an audit trail that can't be altered. It's not a feature. It's the environment.

`// GPR`

---

## Architecture

Turborepo monorepo. Next.js 15 + Express. SQLite everywhere. Deployed on Vercel.

```
apps/
  web/        → Public site, docs, dashboard, admin (Next.js 15)
  api/        → Express backend (existing PJ codebase slot)
  puddles/    → AI chat interface (Vercel AI SDK + Anthropic)

packages/
  core/       → VAULT schema, GPR interfaces, CaseSpace type, audit types
  db/         → SQLite layer (better-sqlite3, WAL, trigger-enforced audit)
  formkey/    → Structured data ingestion runtime
  ui/         → Shared React components
  mcp/        → MCP tools (60+ tools, 12 domains)
  sync8/      → SYNCHRON8 automation + cloud sync + artifact delivery
  archieve/   → ARCHIEVE retention enforcement
  cal/        → CAL Civic Automation Layer
  org-manager/→ Org Manager runtime routing
  config/     → Shared TS/ESLint/Tailwind configs
```

## Principles

1. **Runtime, not engine.** PJ enforces conditions under which work can happen. It doesn't execute the work.
2. **SQLite everywhere.** `better-sqlite3`, WAL mode. No Postgres. No managed DB.
3. **Append-only audit.** `audit_events` cannot be UPDATEd or DELETEd. SQLite triggers enforce this.
4. **AI assists, never decides.** Puddles can surface, summarize, recommend. Humans approve.
5. **Authority is a runtime condition.** VAULT evaluates structural preconditions, not role checks.
6. **Tenant binding on every query.** No cross-tenant data leakage. Ever.
7. **Near-zero sync cost.** No persistent connections. No webhook subscriptions. Push on transfer, pull on casespace open, batch reconcile nightly. Free API tiers handle municipal volume.

## VAULT Framework

**V**erification · **A**uthority · **U**tility · **L**egitimacy · **T**ransfer

Written by Nathan Boudreau. Operationalized by Dr. Allison Weiss Rothschild.

Five conditions that must be true before a governance action should happen.

## Product Suite

| Module | Purpose |
|--------|---------|
| **LogicOS** | Municipal platform — the casespace lives here |
| **VAULT** | Governance doctrine (V·A·U·L·T) — Transfer is the pass-back |
| **Formkey** | Structured data ingestion — forms that create governed records and trigger flows |
| **CAL** | Civic Automation Layer — statutory deadlines, public notice, meeting schedules |
| **ARCHIEVE** | Retention enforcement — you can't delete a governed record before its time |
| **SYNCHRON8** | Automation engine + Cloud Sync — bidirectional, governance-aware, provisions structure |
| **Org Manager** | Runtime routing — resolves position, not roles |
| **Puddles** | AI chat — assists, never decides |

## Architecture Concepts

**CaseSpace** — the runtime context. The join of identity (from SSO), position (from Org Manager),
tools (from MCP, scoped), rules (from VAULT/ARCHIEVE/CAL), deadlines, and institutional context.
Every action happens inside the casespace. That's what makes PJ a runtime.

**Transfer** — the T in VAULT. The governed artifact leaves the runtime and lands in the system of
record (SharePoint, Google Drive, CivicPlus, state portal) with a governance fingerprint attached:
VAULT evaluation ID, audit chain hash, retention policy, authority that approved it.

**Governance Fingerprint** — proof of governed process, embedded in every artifact that leaves PJ.
The fingerprint ties the artifact back to the flow, the VAULT evaluation, and the audit chain.

**Cloud Sync** — SYNCHRON8 handles bidirectional sync with M365/Google/CivicPlus. Won't sync
ungoverned artifacts. Won't delete retained records. Provisions structure on first connect
(retention labels, department scoping, metadata columns, permissions). No persistent connections:
outbound pushes on transfer, inbound pulls on casespace open (delta token stored in SQLite),
nightly batch reconciliation catches drift. Free API tiers handle municipal volume.

**Artifact Generation** — one-pass document creation from flow state. The PRR response letter,
the certified minutes, the issued permit — generated from data already in the runtime, not from
a template. The artifact carries the governance fingerprint.

## Development

```bash
pnpm install
pnpm dev        # All apps in parallel
pnpm build      # Full build
pnpm ship       # Release gate (enforces architecture lock)
```

## Deploy

```bash
# Vercel (web app)
vercel --prod

# API (Vercel serverless or standalone)
# Configure in vercel.json or deploy separately
```

## Live Deployments

- **Phillipston, MA** — CivicPlus migration, PRR framework, FY26
- **Sutton, MA** — Community Compact IT grant
- **Westminster, MA** — Community Compact IT grant
- **NEPM/AED Pocomoke** — $10M+ NMTC biochar compliance

---

**PublicLogic LLC** · Gardner, MA  
Nathan Boudreau & Dr. Allison Weiss Rothschild  
[publiclogic.org](https://publiclogic.org)

*Calm on the surface. Governance machinery underneath.*
