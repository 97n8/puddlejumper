# PublicLogic Systems Map

> Canonical reference for how the PublicLogic ecosystem is wired.
> Last verified: February 2026.

```
   ╔══════════════════════════════════════════════════════════════════════╗
   ║                    PUBLICLOGIC SYSTEMS MAP                         ║
   ╚══════════════════════════════════════════════════════════════════════╝

     INTERNET
     ─────────────────────────────────────────────────────────────────────

     www.publiclogic.org        publiclogic.org/os          pj.publiclogic.org        api.publiclogic.org
     ┌─────────────────┐       ┌──────────────────┐        ┌──────────────────┐       ┌──────────────────┐
     │  Marketing Site │       │  PublicLogic OS  │        │  Next.js         │       │  PuddleJumper    │
     │  (home page,    │──────▶│  (vanilla JS SPA)│◀──────▶│  Frontend        │       │  (backend API)   │
     │   redirect)     │  /os  │  hash routing    │  SSO   │  (React/Next.js) │◀─────▶│  (Express/Node)  │
     └─────────────────┘       └──────────────────┘ iframe └──────────────────┘  API  └──────────────────┘
              │                         │                           │                          │
              │                         │ MSAL auth                 │                          │
              │                    ┌────▼────┐                      │                          │
              │                    │ Entra   │                      │                          │
              │                    │ (Azure  │                      │                          │
              │                    │  AD)    │                      │                          │
              │                    └─────────┘                      │                          │
              │                                                     │                          │
     VERCEL ──┴─────────────────────────────────────  VERCEL ──────┘             FLY.IO ──────┘
     project: publiclogic                             project: pj                 app: publiclogic-puddlejumper
```

## DNS Routing

| Domain | Target | Platform | Content |
|--------|--------|----------|---------|
| `www.publiclogic.org` | `cname.vercel-dns.com` | Vercel | Marketing site |
| `pj.publiclogic.org` | `cname.vercel-dns.com` | Vercel | Next.js frontend |
| `api.publiclogic.org` | `publiclogic-puddlejumper.fly.dev` | Fly.io | PuddleJumper backend API |

See [`docs/DNS.md`](DNS.md) for full DNS configuration.

## Source Repos (GitHub: 97n8)

```
     97n8/Public_Logic                    97n8/puddlejumper (monorepo)
     ┌────────────────────────┐           ┌────────────────────────────────┐
     │ dist/                  │           │ n8drive/apps/puddlejumper/     │
     │   index.html  (root)   │           │   └── PJ backend (Node/Express)│
     │   os/         (OS app) │           │ n8drive/web/                   │
     │     config.js ◀────────┼─── sets ──│   └── Next.js frontend (Vercel)│
     │     assets/            │  PJ URL   │                                │
     └────────────────────────┘           │ publiclogic-os-ui/             │
                │                         │   └── vanilla JS OS (Netlify)  │
                │ deployed to Vercel      │                                │
                │ as publiclogic.org      │ publiclogic-site/              │
                │                         │   └── marketing copy (Netlify) │
                │                         │                                │
     97n8/AGNOSTIC                        │ publiclogic-operating-system/  │
     ┌────────────────────────┐           │   └── playbooks (canonical)    │
     │ PublicLogic OS          │           └────────────────────────────────┘
     │ Component Library      │
     │ (React/Vite — separate)│
     └────────────────────────┘
```

## PuddleJumper Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Runtime** | Node.js 20.x | TypeScript 5.7+ |
| **Framework** | Express 4.x | Deployed on Fly.io |
| **Database** | SQLite (better-sqlite3) | WAL mode, persistent volume at `/app/data` |
| **Auth** | JWT (jose) + OAuth | GitHub, Google, Microsoft providers |
| **Frontend** | Next.js 16.x / React 19 | Deployed on Vercel |
| **Package manager** | pnpm 8.15.8 (backend) / npm (frontend) | Monorepo via pnpm workspaces |

### Data Stores (SQLite WAL)

All databases are SQLite files on a Fly.io persistent volume:

| Database | Purpose |
|----------|---------|
| `approvals.db` | Approval requests, chain steps, decisions |
| `prr.db` | Public Records Requests |
| `connectors.db` | Connector registrations |
| `idempotency.db` | Idempotent request dedup |
| `rate-limit.db` | Rate limiting state |
| `audit.db` | Audit event log |
| `oauth_state.db` | OAuth flow state |

### Dispatch Targets

| Connector | Status | Notes |
|-----------|--------|-------|
| GitHub (Issues/PRs) | Active | Via GitHub API |
| Slack (Messages) | Active | Via Slack webhook |
| SharePoint (Documents) | **Stub** | Not yet implemented — requires Azure AD app |
| Webhook (HTTP POST) | Active | Generic webhook dispatcher |

## PublicLogic OS

| Attribute | Value |
|-----------|-------|
| **Technology** | Vanilla JavaScript (no framework) |
| **Routing** | Hash-based (`window.location.hash`) |
| **Auth** | MSAL Browser (Microsoft Entra ID) |
| **Data** | Microsoft Graph API + SharePoint Online |
| **Deploy target** | Netlify (recommended) or served under `/os` on main site |
| **Config** | `config.js` sets MSAL, SharePoint, and PuddleJumper URLs |

### SharePoint Integration (OS UI)

Site: `publiclogic978.sharepoint.com/sites/PL`

| List | Purpose |
|------|---------|
| `OS Tasks` | Task tracking |
| `OS Pipeline` | Sales/delivery pipeline |
| `OS Projects` | Project management |
| `OS Agenda` | Meeting agendas |
| `OS Scorecard` | KPI scorecard |
| `OS Decisions` | Decision log |

### OS ↔ PuddleJumper Bridge

The OS UI connects to PuddleJumper via `config.puddlejumper.apiUrl`.
After MSAL login, `lib/pj.js` calls `POST /api/auth/token-exchange` to
exchange the Microsoft access token for a PJ session (SSO). The OS includes
a `#/puddlejumper` page that embeds PJ in an iframe.

```
OS UI (MSAL token) ──POST /api/auth/token-exchange──▶ PuddleJumper (JWT session)
```

## Monorepo Structure

```
n8drive/
├── packages/core/          @publiclogic/core — JWT, middleware, CSRF, cookies
├── packages/vault/          @publiclogic/vault — policy provider (planned)
├── apps/logic-commons/     @publiclogic/logic-commons — OAuth, session, audit
├── apps/puddlejumper/      Governance control plane
│   ├── public/             Static assets (admin, guide, workspace)
│   ├── src/api/            Express server, routes, middleware
│   └── src/engine/         Stores, dispatchers, governance engine
├── web/                    Next.js frontend (Vercel)
├── ops/                    Runbooks, DR plan, operational docs
├── Dockerfile              Multi-stage build for Fly.io
└── fly.toml                Fly.io deployment config
```

## What the Original Diagram Got Wrong

The diagram in the issue contained several inaccuracies relative to the
actual codebase:

| Claim | Reality |
|-------|---------|
| `pj.publiclogic.org` → "PuddleJumper (backend app)" | `pj.publiclogic.org` → Vercel (Next.js frontend); backend is at `api.publiclogic.org` → Fly.io |
| PublicLogic OS is a "React SPA" with "HashRouter" | OS UI (`publiclogic-os-ui/`) is vanilla JavaScript with hash-based routing — not React |
| PuddleJumper → "Fly.io Postgres" | PuddleJumper uses **SQLite** (better-sqlite3) on a Fly.io persistent volume — no Postgres |
| PuddleJumper → "Supabase (auth + realtime)" | PuddleJumper uses **JWT auth** (jose library) + OAuth providers — no Supabase |
| SharePoint lists: MunicipalVault, PL\_PRR\_Cases, PL\_PRR\_Audit | Actual SharePoint lists: OS Tasks, OS Pipeline, OS Projects, OS Agenda, OS Scorecard, OS Decisions |
| PJ dispatches to SharePoint | SharePoint dispatcher is a **stub** (not yet implemented) |
| Missing `api.publiclogic.org` | Backend API is served at `api.publiclogic.org`, not `pj.publiclogic.org` |
