# PuddleJumper — User Guide

> PublicLogic governance control surface for public-sector data operations.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Dashboard](#dashboard)
4. [Governance Engine](#governance-engine)
5. [Public Records Requests (PRR)](#public-records-requests)
6. [Access Requests](#access-requests)
7. [Connector Management](#connector-management)
8. [Embedded Widget](#embedded-widget)
9. [API Reference](#api-reference)
10. [Security Model](#security-model)

---

## Getting Started

PuddleJumper is a monorepo with three main surfaces:

| Surface | URL | Purpose |
|---------|-----|---------|
| **Web App** | `pj.publiclogic.org` | Dashboard, governance, login |
| **PJ API** | `publiclogic-puddlejumper.fly.dev` | Governance engine, PRR, connectors |
| **Logic Commons API** | Vercel (or `:3002` locally) | Authentication, token management |

### Prerequisites

- A **GitHub** or **Google** account for authentication.
- A modern browser (Chrome, Firefox, Safari, Edge).

---

## Authentication

### Logging In

1. Navigate to the web app home page.
2. Select a provider (**GitHub** or **Google**).
3. Complete the OAuth flow with your provider.
4. On success, you receive a short-lived access token (1 hour) and a refresh cookie (7 days).

### Session Lifecycle

| Event | What Happens |
|-------|-------------|
| **Login** | Access token (1h) returned in JSON; refresh token set as `HttpOnly` cookie |
| **Silent refresh** | The app automatically refreshes your token 60 seconds before it expires — no user action needed |
| **Token replay** | If a previously used refresh token is replayed (possible theft), the entire token family is revoked and all sessions for that chain are invalidated |
| **Logout** | Calls `POST /api/auth/logout` — revokes your refresh token server-side and clears the cookie |
| **Session expiry** | If silent refresh fails (e.g., cookie expired or revoked), the UI clears your session and returns to the login screen |

### Roles

| Role | Access Level |
|------|-------------|
| **Viewer** | Read-only access to dashboards and public data |
| **Operator** | Can execute governed actions and view redacted system prompts |
| **Admin** | Full access — can view system prompts, revoke other users' tokens, manage connectors |

---

## Dashboard

**Route:** `/dashboard`

The dashboard provides a tabular view of Public Records Requests assigned to your tenant.

### Features

- **PRR table** — columns: Public ID, Status (color-coded badge), Tenant, Received Date, Due Date
- **Status badges** — `received` (blue), `acknowledged` (yellow), `in_progress` (orange), `extended` (purple), `closed` (green)
- **Refresh** — reload the table from the server
- **Auth-gated** — requires an active session; unauthenticated users see a login prompt

---

## Governance Engine

**Route:** `/governance`

The governance engine evaluates whether a proposed action (e.g., creating an environment, deploying a policy) is approved or rejected based on rules, roles, scope, and workspace charter.

### What You Can Do

- **View your permissions** — all capability flags are listed with ✓/✗ indicators:
  - `corePrompt.read` / `corePrompt.edit`
  - `evaluate.execute`
  - `missionControl.tiles.read` / `missionControl.tiles.customize`
  - `missionControl.capabilities.read`
  - `popout.launch`
- **View available actions** — if you have `evaluate.execute`, the page lists PJ actions you can perform:
  - `environment.create` — Create Environment
  - `environment.update` — Update Environment
  - `environment.promote` — Promote Environment
  - `environment.snapshot` — Snapshot Environment
- **View system prompt** — admins see the full system prompt; operators see a redacted summary
- **Execute governed actions** — actions are evaluated against workspace charter, tenant scope, operator role, and connector configuration before approval

### Governance Decisions

Every governed action returns:

| Field | Description |
|-------|-------------|
| **Decision** | `approved` or `rejected` |
| **Rationale** | Human-readable explanation |
| **Evidence** | Statute, policy key, delegation chain, permission check, connector evidence |
| **Plan hash** | SHA-256 hash of the execution plan for audit verification |
| **LCD status** | Short status text |
| **Toast** | Notification (info / warn / error / success) |

### Injection Protection

Payloads containing adversarial patterns (e.g., "ignore rules", "bypass governance", "auto-approve") are automatically blocked.

---

## Public Records Requests

### Submitting a PRR (Public — No Login Required)

Send a `POST /api/prr/intake` with your request details. You receive a **tracking ID** and URL.

### Tracking a PRR (Public)

Visit `GET /api/public/prrs/:publicId` with your tracking ID to see:
- Current status
- Due date (5 business days from receipt)
- Summary
- Agency name

### Managing PRRs (Authenticated)

| Endpoint | Action |
|----------|--------|
| `GET /api/prr` | List PRRs for your tenant (filterable, paginated) |
| `POST /api/prr/:id/status` | Transition status: `received → acknowledged → in_progress → extended / closed` |
| `POST /api/prr/:id/close` | Close with disposition |

---

## Access Requests

### Submitting an Access Request (Public)

`POST /api/access/request` — provide requester info, requested role, target system, and justification. A notification is enqueued for the admin team.

### Managing Access Requests (Authenticated)

| Endpoint | Action |
|----------|--------|
| `POST /api/access/request/:id/status` | Transition: `received → under_review → approved → provisioned → revoked → closed` (or `denied`) |
| `POST /api/access/request/:id/close` | Close with resolution |

Access request notifications are delivered via HMAC-signed webhooks with exponential backoff on failure.

---

## Connector Management

PuddleJumper integrates with external services through OAuth-authenticated connectors.

### Supported Providers

| Provider | Capabilities |
|----------|-------------|
| **Microsoft** | SharePoint uploads, Power Automate flow dispatch, Azure AD provisioning |
| **Google** | Drive uploads, notifications |
| **GitHub** | Branch-and-PR, direct commits, repo search |

### Connector Workflow

1. **Connect** — `POST /api/connectors/:provider/auth/start` initiates OAuth
2. **Callback** — the provider redirects back; tokens are stored securely
3. **Browse** — `GET /api/connectors/:provider/resources` searches repos, files, folders
4. **Disconnect** — `POST /api/connectors/:provider/disconnect` removes stored tokens
5. **Status** — `GET /api/connectors/` lists all connector statuses (connected, scopes, expiry)

---

## Embedded Widget

PuddleJumper can run as an embedded widget inside a parent application using `<iframe>`.

### Simple Governance Showcase

The standalone HTML widget (`puddlejumper_simple_final.html`) provides:

- **Role-based demo** — Viewer, Clerk, Chair, Auditor, Legal roles control available actions
- **Environment selector** — create and switch between environments
- **Navigator panel** — mode switching (Connectors / Projects), connector filtering (GitHub, Drive, SharePoint, Bookmarks)
- **Search** — search across items by name, project, or tags
- **Detail card view** — inspect selected items

### Master Environment Control

The full operator control surface (`puddlejumper-master-environment-control.html`) provides:

- Navigator with tree view and search
- Tile deck with live tiles (customizable, merged with server config)
- Action execution with payload preview and audit output
- Health check and advanced configuration panels
- Five color tone variants

### PostMessage Integration

When embedded, the widget communicates with its parent via `postMessage`:

- **Origin validation** — only messages from trusted origins (configured via `<meta name="pj-trusted-parent-origins">`) are accepted
- **Source check** — `event.source` must be `window.parent`
- **Message types**: `PJ_IDENTITY_CONTEXT`, `IDENTITY_UPDATE`, `pj.identity`, `PJ_AUTH_TOKEN`, `PJ_CONTEXT_REQUEST`
- **No wildcard `'*'` targetOrigin** — all outbound messages are sent to specific validated origins only

---

## API Reference

### Authentication (Logic Commons)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/login` | None | Login with `{ provider, providerToken }` |
| `POST` | `/api/refresh` | Cookie | Rotate refresh token, get new access token |
| `POST` | `/api/auth/logout` | Cookie | Revoke refresh token, clear cookie |
| `POST` | `/api/auth/revoke` | Bearer | Revoke all tokens for user (admin can target others) |
| `GET` | `/health` | None | Health check |

### Governance & Runtime (PuddleJumper API)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/evaluate` | Bearer (`deploy` perm) | Evaluate a governance decision |
| `POST` | `/api/pj/execute` | Bearer | Execute a governed action |
| `GET` | `/api/pj/actions` | Bearer | List available PJ actions |
| `GET` | `/api/capabilities/manifest` | Bearer | User's capability manifest |
| `GET` | `/api/runtime/context` | Bearer | Workspace/municipality/operator context |
| `GET` | `/api/config/tiles` | Bearer | Live tiles configuration |
| `GET` | `/api/config/capabilities` | Bearer | Live capabilities (automations, quick actions) |
| `GET` | `/api/prompt` | Bearer (admin) | Full system prompt |
| `GET` | `/api/core-prompt` | Bearer | Full or redacted system prompt |
| `GET` | `/api/identity` | Bearer | Authenticated user info |

### Public Records Requests

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/prr/intake` | None | Submit a PRR |
| `GET` | `/api/prr` | Bearer | List PRRs for tenant |
| `POST` | `/api/prr/:id/status` | Bearer | Transition PRR status |
| `POST` | `/api/prr/:id/close` | Bearer | Close PRR |
| `GET` | `/api/public/prrs/:publicId` | None | Public PRR tracking |

### Access Requests

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/access/request` | Optional | Submit access request |
| `POST` | `/api/access/request/:id/status` | Bearer | Transition status |
| `POST` | `/api/access/request/:id/close` | Bearer | Close request |

### Connectors

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/connectors/` | Bearer | List connector statuses |
| `POST` | `/api/connectors/:provider/auth/start` | Bearer | Start OAuth flow |
| `GET` | `/api/connectors/:provider/auth/callback` | — | OAuth callback |
| `POST` | `/api/connectors/:provider/disconnect` | Bearer | Disconnect provider |
| `GET` | `/api/connectors/:provider/resources` | Bearer | Search provider resources |

---

## Security Model

### CSRF Protection

All mutating API calls (`POST`, `PUT`, `PATCH`, `DELETE`) require the `X-PuddleJumper-Request: true` header. The `pjFetch` wrapper adds this automatically.

### Content Security Policy

- **Web app** — per-request nonce-based CSP via middleware; `script-src 'nonce-…' 'strict-dynamic'`; no `unsafe-inline` or `unsafe-eval`
- **Embedded widgets** — SHA-256 hash-based CSP for inline scripts/styles; hash computed at startup from file contents

### Token Security

| Property | Value |
|----------|-------|
| Cookie flags | `HttpOnly`, `Secure` (production), `SameSite=Lax` |
| Access token lifetime | 1 hour |
| Refresh token lifetime | 7 days |
| Refresh storage | SQLite (WAL mode), family-based rotation chains |
| Replay detection | Reuse of revoked token revokes entire family |
| Correlation IDs | Every request receives an `x-request-id` header (generated or forwarded) |
| Audit logging | All auth events (login, refresh, logout, revoke, replay) emit structured JSON logs |

### Rate Limiting

Sensitive endpoints (`/api/login`, `/api/evaluate`, `/api/prompt`, `/api/pj/execute`) are rate-limited with in-memory buckets.

### Input Validation

All API inputs are validated with Zod schemas. Unknown fields are rejected. Governance payloads are scanned for injection patterns.

### SSRF Protection

Remote canonical source fetches block private IPs, enforce host allowlists, and limit response size (1 MB) and timeout (3 seconds).

---

## Environment Variables

See [ENV_REFERENCE.md](ENV_REFERENCE.md) for the complete list. Key variables:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Symmetric signing key for JWTs |
| `AUTH_ISSUER` / `AUTH_AUDIENCE` | JWT `iss` / `aud` claims |
| `PJ_CLIENT_ID` | Google OAuth client ID |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials |
| `CONTROLLED_DATA_DIR` | SQLite database directory (default: `./data`) |
| `LOGIC_COMMONS_DATA_DIR` | Logic Commons SQLite directory |
| `NEXT_PUBLIC_API_URL` | API base URL for the Next.js frontend |
| `PJ_TRUSTED_PARENT_ORIGINS` | Comma-separated trusted origins for iframe embedding |
| `DEV_MODE` | Enable dev-only endpoints (`true`/`false`) |

---

## Deployment

| Target | Method |
|--------|--------|
| **PJ API** | Fly.io — `fly deploy` (Dockerfile, multi-stage, node:20-slim) |
| **Web App** | Vercel — automatic from `web/` workspace |
| **Logic Commons** | Vercel — exported as `serverless-http` handler |
| **Local dev** | `pnpm dev` from root; PJ API on `:3002`, web on `:3000` |

See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) for deployment steps.
