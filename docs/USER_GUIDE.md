# LogicOS — User Guide

> PublicLogic LLC · LogicSuite Platform · Municipal Governance Intelligence

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Tools Reference](#tools-reference)
   - [LogicPen](#logicpen)
   - [Vault](#vault)
   - [Builder](#builder)
   - [CaseSpaces](#casespaces)
   - [LogicBackend](#logicbackend)
   - [FormKey](#formkey)
   - [Flows (SYNCHRON8)](#flows-synchron8)
   - [CivicPulse](#civicpulse)
   - [LogicSuite](#logicsuite)
   - [AXIS](#axis)
   - [Workspace](#workspace)
   - [LogicCommons](#logiccommons)
   - [Audit Trail](#audit-trail)
   - [Settings](#settings)
   - [Admin](#admin)
4. [Roles and Permissions](#roles-and-permissions)
5. [Backend Modules](#backend-modules)
6. [PJ API Reference](#pj-api-reference)
7. [Security Model](#security-model)
8. [Environment Variables](#environment-variables)
9. [Deployment](#deployment)

---

## System Overview

LogicSuite is a public-sector governance platform consisting of two main surfaces:

| Surface | URL | Purpose |
|---|---|---|
| **LogicOS** | `os.publiclogic.org` | The primary user interface — all tools live here |
| **PuddleJumper (PJ)** | `pj.publiclogic.org` | The backend API engine and admin surface |

### Architecture at a Glance

```
LogicOS (Cloudflare Pages)
    └─ React SPA — all tools in one authenticated shell

PuddleJumper (Fly.io — publiclogic-puddlejumper)
    └─ Node.js/Express monorepo — in-process backend modules
         ├─ ARCHIEVE    Tamper-evident audit event chain
         ├─ VAULT       Governed document and record storage
         ├─ SEAL        ECDSA-P256 cryptographic sealing
         ├─ AXIS        AI provider credential management
         ├─ Template Library  Output template rendering (stub)
         ├─ FormKey     Intake forms, consent gate, printed output
         ├─ LOGICBRIDGE Connector registry and API explorer
         ├─ SYNCHRON8   Feed-based automation triggers
         └─ CaseSpace Factory  Governance environment wiring
```

All data at rest is stored in SQLite (WAL mode) on a Fly.io persistent volume. All write operations to governed records produce a SEAL token and an ARCHIEVE event that cannot be modified after the fact.

---

## Getting Started

### Sign In

1. Navigate to [os.publiclogic.org](https://os.publiclogic.org)
2. Click **Sign in with GitHub** or **Sign in with Google**
3. Complete the OAuth flow — you return to LogicOS logged in
4. The Start Screen shows all tools your role has access to

### Session Lifecycle

| Event | What Happens |
|---|---|
| **Login** | Access token (1h) + refresh cookie (7 days, HttpOnly) |
| **Silent refresh** | Token renewed 60 seconds before expiry — no user action |
| **Replay attack** | Reusing a revoked refresh token revokes the entire token family |
| **Logout** | Token revoked server-side; cookie cleared |

### Start Screen

The Start Screen is the home for LogicOS. It shows:
- All tools available to your role with one-click access
- Recent CaseSpaces (governed environments) you've worked in
- Quick links to open a new CaseSpace or start a new document

---

## Tools Reference

### LogicPen

**What it is:** A full HTML/CSS/JS document editor with live preview, designed for producing governed printed documents.

**Access:** All authenticated users

**Features:**
- **Multi-project** — create and switch between multiple documents; projects persist in localStorage and can be saved to Vault
- **Split/Code/Write/Preview modes** — edit raw HTML/CSS/JS or write in a rich text view
- **Page sizes** — Free, Letter (8.5×11), A4, Legal, Slide 16:9, Square — affects print output
- **Templates** — built-in document templates (Blank, Business Memo, Staff Kickoff Email, Invoice, Proposal) plus your LogicCommons templates appear in a separate section
- **Print** — prints the live preview at the configured page size
- **Save to Vault** — sends the rendered HTML to Vault as a governed document with classification and status

**Template dialog:** Click the template icon in the toolbar (or "Browse templates" on the empty state) to open the dialog. Your LogicCommons marketplace templates appear below the built-in templates as a "From LogicCommons" section when any exist.

---

### Vault

**What it is:** Governed document storage with classification, version history, and SEAL signing.

**Access:** All authenticated users

**Features:**
- **Document list** — browse all Vault documents for your tenant, filter by status and classification
- **Create / Upload** — add new documents via the Vault interface or save from LogicPen
- **Classification levels:** `public`, `internal`, `confidential`, `restricted`
- **Status lifecycle:** `draft → review → approved → archived`
- **SEAL signing** — sign any document with SEAL (ECDSA-P256). The SealToken is stored with the document and can be verified offline
- **Version history** — every update creates a new version; previous versions are accessible
- **VAULT Files** — binary file attachments (PDFs, images) stored on the Fly.io persistent volume

---

### Builder

**What it is:** A guided wizard for setting up a complete governance environment for a municipality.

**Access:** Admin, owner

**Workflow:**

1. **Select a town** — choose from a list of Massachusetts municipalities (or enter custom)
2. **Select modules** — pick which governance modules to enable:
   - Public Records Requests (PRR)
   - Board Compliance
   - Fiscal Governance
   - Budget Transparency
   - Personnel Records
   - Contracts & Procurement
   - Infrastructure & Assets
   - SEAL & Audit
3. **Configure each module** — set field schemas, retention tiers, custom fields, connector destinations, and enforcement mode
4. **Review** — see a summary of all configured modules
5. **Activate** — creates the CaseSpace (governed environment) in PuddleJumper and provisions the configured modules

The Builder persists your session in localStorage so you can pause and return.

---

### CaseSpaces

**What it is:** Governed environments — each CaseSpace is a configured, SEAL-tracked workspace for a specific governance domain (e.g., a town's permit management system).

**Access:** Authenticated users (access controlled per CaseSpace)

**CaseSpaces Panel (list view):**
- Browse all CaseSpaces for your workspace
- Create a new CaseSpace (name, description, type, tags)
- See status and last-updated timestamps
- Enter a CaseSpace to open its workspace

**CaseSpace Workspace (inside a CaseSpace):**
- **Overview** — governance metadata, status, configured modules
- **LogicDocs** — document management within the environment *(coming soon)*
- **DocDump** — bulk document processing *(coming soon)*
- **Governed actions** — module-specific actions that route through approval chains

---

### LogicBackend

**What it is:** Two tools in one panel — the **LOGICBRIDGE Connector Builder** and the **API Explorer**.

**Access:** Admin, owner

#### LOGICBRIDGE Connector Builder

Build, test, and publish governed API connectors. Each connector:
- Has a name, description, base URL, capabilities, and data types
- Can have a JavaScript handler (runs in a sandboxed VM on PJ)
- Goes through a publish pipeline: draft → simulate → publish (SEAL-signed on publish)
- Published connectors are available to SYNCHRON8 and CaseSpace Factory

**Connector states:**
| State | Description |
|---|---|
| `draft` | Editable; not available to other modules |
| `simulated` | Handler has run against sample payload; simulation result stored |
| `published` | SEAL-signed and registered; available platform-wide |
| `deprecated` | Retired; no new usage; existing integrations continue |

#### API Explorer

Test live API endpoints against connected providers (GitHub, Microsoft, Google, PuddleJumper).

- **Provider selector** — choose a provider; dot indicates connection status
- **Category + endpoint** — browse available endpoints by category
- **Breadcrumb navigation** — click the provider name to return to the welcome state
- **URL bar** — see the exact endpoint URL before running
- **Response viewer** — Raw JSON or Smart (formatted) display; Code tab shows a ready-to-use snippet; History tab shows past requests from this session

---

### FormKey

**What it is:** The intake and output engine. Every governed form submission starts here. Every governed printed document output starts here.

**Access:** Admin, owner (form management); Public (form submission via `/v1/forms/:id/submit`)

**Two execution paths:**

#### Intake Path
Citizens or systems submit data through a governed form. FormKey:
1. Validates fields against the FormDefinition schema
2. Checks that consent exists (for forms requiring it)
3. Seals the submission with ECDSA-P256 (SEAL) over the JCS-canonical field values
4. Writes a VAULT record with a pre-stamped governance envelope (purpose, legalBasis, retentionTier)
5. Logs FORMKEY_INTAKE_SUBMITTED to ARCHIEVE

#### Output Path
A VAULT intake record is rendered as a governed printed form. FormKey:
1. Verifies the intake SEAL before producing any output (a broken seal = no render)
2. Resolves field bindings from the FormDefinition output config
3. Returns JSON bindings or HTML (Template Library rendering in future)

**FormKey Panel tabs:**

**Forms tab** — list all FormDefinitions for your tenant
- Status badges: `draft` (slate), `published` (emerald), `deprecated` (amber), `suspended_mismatch` (red)
- Click **View** to expand a form and see its fields, consent config, and actions
- **New Form** — create a draft with formId (slug), name, legalBasis, purpose, retentionTier
- **Publish** — runs the 5-step publish pipeline (preflight → consent hash → SEAL sign → VAULT write → ARCHIEVE event)
- **Deprecate** — retires a published form (existing records unaffected)

**Submissions tab** — select a form to browse its intake records
- Each row shows: record ID, submittedAt, formVersion, retentionTier, legalBasis
- **Render** — call the output renderer and see the JSON binding result

**Consent tab** — look up a submitter's consent status by submitterId + form

**Legal basis guide:**
| legalBasis | Consent required? | Example |
|---|---|---|
| `consent` | Yes — hard block if missing | Health data intake, optional survey |
| `legal_obligation` | No | Building permit application |
| `public_task` | No | Public records request |
| `contract` | No | Vendor registration |

---

### Flows (SYNCHRON8)

**What it is:** Automation flows — pre-built integrations that connect your Microsoft 365, Google Workspace, and GitHub accounts to produce governed outputs.

**Access:** Authenticated users (Admin for governance pages)

**Sidebar navigation:**

| Section | Page | Status |
|---|---|---|
| Automations | **Flows** | ✅ Full — install, configure, enable/disable, run |
| Automations | **Catalog** | ✅ Full — 100+ pre-built recipes by category |
| Automations | **Run History** | ✅ Full — past flow runs with status and output |
| Compliance | Attestations | Placeholder |
| Compliance | Evidence | Placeholder |
| Compliance | Profiles | Placeholder |
| Governance | **Audit Log** | ✅ Opens AuditTrailPanel (ARCHIEVE event viewer) |
| Governance | Legal Holds | Placeholder |

**Installing a flow:**
1. Go to **Catalog** and browse or search 100+ recipes
2. Click **Install** — some flows open a config dialog for required fields (email addresses, repo names, etc.)
3. The installed flow appears in **Flows** where you can enable/disable it or run it manually

**Flow categories:** Email & Calendar, Files & Storage, GitHub, Civic & Government, Data & Utilities, AI & Summaries, Compliance, Connectors, VAULT Integration

---

### CivicPulse

**What it is:** The automated civic transparency engine. CivicPulse monitors VAULT records and automatically generates plain-language civic summaries for public publication — board votes, contract awards, financial actions.

**Access:** Admin, owner

**Tabs:**
- **Approval Queue** — summaries awaiting staff review before publication. For each item: read the headline/body, verify against the VAULT source record, then Approve or Reject with a reason. SEAL mismatch items cannot be approved.
- **Compliance Backstop** — items that passed a publication deadline without entering the workflow. These require immediate attention.
- **Publication Log** — history of all published summaries with channel, timestamp, and ARCHIEVE link
- **Channel Config** — configure output channels (website post, activity feed, email digest) and approval behavior

**Governance chain (automatic):**
VAULT record created → ARCHIEVE evaluates → Summary generated → SEAL validates → Routing decision → Staff review (you) → Published + logged

---

### LogicSuite

**What it is:** An aggregated hub view of your workspace — files, automations, GitHub activity, and CivicPulse entries in one dashboard. Also includes a cross-tool search and cloud sync status.

**Access:** Authenticated users

**Sections:**
- **Overview** — snapshot of recent files, active automations, repo activity, and CivicPulse entries with quick-launch buttons into each tool
- **Search** — search across local files, Vault documents, GitHub repos, automations, and CivicPulse entries simultaneously
- **Cloud Sync** — status of GitHub, Microsoft 365, and Google Workspace connections; browse resources from each provider

---

### AXIS

**What it is:** AI assistant with access to your connected providers (GitHub, Microsoft, Google).

**Access:** Authenticated users

**Capabilities:**
- Ask questions answered by live data from your connected accounts
- Draft documents, summarize content, generate code
- AXIS routes requests to the appropriate provider credential and returns results through the governed API layer

**Note:** AXIS requires live provider API keys configured as Fly.io secrets (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`). Until set, AXIS shows 0 live providers.

---

### Workspace

**What it is:** A multi-provider file browser for GitHub, Microsoft 365, and Google Workspace.

**Access:** Authenticated users (requires connected accounts)

**Browsers:**
- **GitHub File Browser** — browse repos, files, and folders; view file content
- **Microsoft File Browser** — browse OneDrive and SharePoint; preview documents
- **Google File Browser** — browse Drive files and folders

Connect your accounts via **Connections** (toolbar button or Settings).

---

### LogicCommons

**What it is:** A template marketplace for document and workflow templates. Templates you create or download here also appear in LogicPen's template dialog for direct use.

**Access:** All authenticated users

**Features:**
- Browse 8+ seed templates: Project Kickoff Brief, Meeting Notes, React Component, Weekly Status Report, API Route Handler, Budget Spreadsheet, Decision Log, README Template
- **Download** — saves the template as a file (`.md`, `.csv`, etc.)
- **Publish** — add your own template to the commons (name, description, category, content)
- Templates are stored in localStorage and shared with LogicPen's template picker

---

### Audit Trail

**What it is:** A viewer for the ARCHIEVE tamper-evident audit event chain. Every significant action in LogicSuite produces an ARCHIEVE event with a cryptographic chain linking each event to the previous one.

**Access:** Admin, owner (accessible from toolbar or from Flows → Audit Log)

**Features:**
- **Event stream** — paginated list of all ARCHIEVE events filterable by module, event type, tenant, and time range
- **Event detail** — full JSON payload for any event
- **Chain verification** — verify the integrity of the entire chain from head to tail; any gap or hash mismatch is flagged
- **Notarizations** — TSA (RFC 3161) timestamp notarization records for long-term verifiability
- **Export** — download events for a date range as CSV or JSON

**Modules logged:** `seal`, `formkey`, `logicbridge`, `syncronate`, `archieve` (self-logging), and all other PJ modules

---

### Settings

**What it is:** User preferences and account management.

**Access:** All authenticated users

**Sections:**
- Profile information and display preferences
- Notification settings
- API token management (for integrating external tools with LogicOS)

---

### Admin

**What it is:** Platform administration. Owner and admin roles only.

**Access:** Owner, admin

**Panels:**

| Panel | What it does |
|---|---|
| **PJ Health** | Live status of all PuddleJumper backend modules (ARCHIEVE, VAULT, SEAL, AXIS, FormKey, LOGICBRIDGE, SYNCRONATE, etc.). Shows queue depths, registry counts, error rates. |
| **Membership** | Invite users, set roles, manage tool access permissions per member |
| **SEAL Keys** | View active ECDSA-P256 signing keys per tenant; rotate keys; view public key PEM for offline verification |
| **Azure / M365 Setup** | Configure Microsoft 365 tenant integration and Azure AD app registration |

---

## Roles and Permissions

| Role | Tools Available | Notes |
|---|---|---|
| **owner** | All tools including Admin | Full access; cannot be removed |
| **admin** | All tools including Admin | Same as owner except cannot modify owner |
| **editor** | All tools except Admin | Can create and modify content |
| **member** | All tools except Admin (default) | Standard user |
| **viewer** | Read-only where applicable | Restricted; no create/edit |

**Tool-specific access** can be granted per member by an admin. Example: a member with `logicbackend` in their `toolAccess` list can access LOGICBRIDGE even if they don't have editor rights everywhere.

**Admin-only tools:** Admin panel, Audit Trail, FormKey, SYNCRONATE, FormKey

---

## Backend Modules

PuddleJumper loads modules in boot order. Each module's status is visible in the Admin → PJ Health panel.

| # | Module | Status | Description |
|---|---|---|---|
| 1 | **KMS Client** | Live | Key management — signs and rotates SEAL keys |
| 2 | **ARCHIEVE** | Live | Tamper-evident audit event chain (WAL-backed SQLite) |
| 3 | **VAULT** | Live | Governed document and record storage |
| 4 | **SEAL** | Live | ECDSA-P256 cryptographic signing and verification |
| 5 | **Template Library** | Stub | Output template rendering (FormKey output uses JSON for now) |
| 6 | **AXIS** | Live (no providers) | AI provider credential resolution |
| 7 | **FormKey** | Live | Intake forms, consent gate, SEAL stamp, output rendering |
| 8 | **LOGICBRIDGE** | Live | Connector registry, sandbox handler runner, API explorer |
| 9 | **SYNCHRON8** | Stub | Feed-based automation triggers (health stub only) |
| 10 | **CaseSpace Factory** | Stub | Governed environment provisioning |
| 11 | **Module Maker** | Not built | Custom module builder |
| 12 | **SYNCRONATE** | Live | Cross-system data sync orchestration |

**Health endpoint:** `GET /v1/health` returns the status of every module.

---

## PJ API Reference

All endpoints are at `pj.publiclogic.org` (production) or `localhost:3002` (local dev).

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/github/login` | public | GitHub OAuth redirect |
| `GET` | `/api/auth/google/login` | public | Google OAuth redirect |
| `GET` | `/api/auth/microsoft/login` | public | Microsoft OAuth redirect |
| `POST` | `/api/refresh` | cookie | Rotate refresh token |
| `POST` | `/api/auth/logout` | cookie | Revoke session |
| `GET` | `/api/identity` | bearer | Current user info |

### FormKey

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/formkey/forms` | bearer | List FormDefinitions |
| `POST` | `/api/formkey/forms` | bearer | Create draft FormDefinition |
| `GET` | `/api/formkey/forms/:id` | bearer | Get FormDefinition |
| `PUT` | `/api/formkey/forms/:id` | bearer | Update draft (409 if published) |
| `POST` | `/api/formkey/forms/:id/publish` | admin | Publish (5-step pipeline) |
| `POST` | `/api/formkey/forms/:id/deprecate` | admin | Deprecate |
| `POST` | `/v1/forms/:id/submit` | public (rate limited) | Submit intake |
| `POST` | `/v1/forms/:id/consent` | public | Grant consent |
| `DELETE` | `/v1/forms/:id/consent/:submitterId` | bearer | Withdraw consent |
| `GET` | `/api/formkey/forms/:id/render/:recordId` | bearer | Render VAULT record as form output |
| `GET` | `/api/formkey/forms/:id/submissions` | bearer | List intake records |
| `GET` | `/api/formkey/forms/:id/submissions/:recordId` | bearer | Get intake record |

### LOGICBRIDGE

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/logicbridge/connectors` | bearer | List connectors |
| `POST` | `/api/logicbridge/connectors` | bearer | Create connector |
| `GET` | `/api/logicbridge/connectors/:id` | bearer | Get connector |
| `PATCH` | `/api/logicbridge/connectors/:id` | bearer | Update connector |
| `DELETE` | `/api/logicbridge/connectors/:id` | bearer | Delete connector |
| `POST` | `/api/logicbridge/connectors/:id/simulate` | bearer | Run simulation |
| `POST` | `/api/logicbridge/connectors/:id/publish` | bearer | Publish (SEAL sign) |
| `POST` | `/api/logicbridge/connectors/:id/deprecate` | bearer | Deprecate |
| `POST` | `/api/logicbridge/explorer/request` | bearer | API Explorer live request |

### SEAL

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/seal/verify` | bearer | Verify a SealToken against artifact |
| `GET` | `/api/seal/public-key` | public | Get public key PEM (for offline verify) |
| `GET` | `/api/seal/keys` | bearer | List ESK versions for tenant |
| `POST` | `/api/seal/rotate` | admin | Rotate active signing key |
| `POST` | `/api/seal/provision` | admin | Provision key for a new tenant |

### ARCHIEVE

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/archieve/events` | bearer | Paginated event stream (filter by module, type, tenant, time) |
| `GET` | `/api/archieve/events/:eventId` | bearer | Single event |
| `GET` | `/api/archieve/chain` | bearer | Chain summary (head hash, length) |
| `POST` | `/api/archieve/verify` | bearer | Run chain integrity verification |
| `GET` | `/api/archieve/notarizations` | bearer | TSA notarization records |
| `GET` | `/api/archieve/export` | bearer | Download events as CSV/JSON |

### SYNCRONATE

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/syncronate/dashboard` | bearer | Dashboard stats |
| `GET` | `/api/syncronate/feeds` | bearer | List feed definitions |
| `POST` | `/api/syncronate/feeds` | bearer | Create feed |
| `GET` | `/api/syncronate/jobs` | bearer | List sync jobs |
| `POST` | `/api/syncronate/feeds/:feedId/trigger` | bearer | Manually trigger a feed sync |

### Workspace / Connectors

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/connectors/` | bearer | List all connector statuses |
| `POST` | `/api/connectors/:provider/auth/start` | bearer | Start OAuth flow |
| `POST` | `/api/connectors/:provider/disconnect` | bearer | Disconnect provider |
| `GET` | `/api/connectors/:provider/resources` | bearer | Browse provider resources |

### Governance & PRR

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/prr/intake` | public | Submit a Public Records Request |
| `GET` | `/api/prr` | bearer | List PRRs for tenant |
| `POST` | `/api/prr/:id/status` | bearer | Transition PRR status |
| `POST` | `/api/prr/:id/close` | bearer | Close PRR |
| `GET` | `/api/public/prrs/:publicId` | public | Public PRR tracking |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/health` | public | Full module health (all PJ modules) |
| `GET` | `/health` | public | Basic health check |
| `GET` | `/ready` | public | Readiness probe |

---

## Security Model

### CSRF Protection
All mutating API calls require the `X-PuddleJumper-Request: true` header. The `pjFetch` wrapper in LogicOS adds this automatically.

### Cryptographic Sealing (SEAL)
Every governed artifact — form definitions, connector handlers, intake submissions, and civic summaries — is sealed with ECDSA-P256. The SealToken includes:
- `artifactHash` — SHA-256 of the JCS-canonical artifact
- `signature` — base64url DER ECDSA-P256 signature
- `keyId` — references the tenant's active signing key
- `signedAt` — ISO 8601 timestamp
- `tsaToken` (optional) — RFC 3161 TSA timestamp for long-term verifiability

**Offline verification:**
```bash
openssl dgst -sha256 -verify pubkey.pem -signature sig.bin canonical.json
```

### ARCHIEVE Chain Integrity
Every event is chained: `hash = SHA-256(JCS(event) + prevHash + HMAC)`. Any gap or modification in the chain is detected by `POST /api/archieve/verify`.

### Token Security

| Property | Value |
|---|---|
| Cookie flags | `HttpOnly`, `Secure` (production), `SameSite=Lax` |
| Access token lifetime | 1 hour |
| Refresh token lifetime | 7 days |
| Replay detection | Reuse of revoked token revokes entire family |

### FormKey Public Endpoint Security
`POST /v1/forms/:id/submit` is the only unauthenticated endpoint. Rate limit: 10 requests/IP/minute/form. All submissions (including rejected) are logged to ARCHIEVE.

### Sandbox (LOGICBRIDGE)
Handler code runs in `vm.runInNewContext` (Node.js sandbox fallback). Isolated-vm isolation is the target; currently falls back due to isolated-vm/Node 20 incompatibility.

---

## Environment Variables

Key variables for PuddleJumper on Fly.io:

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | Yes | JWT signing key (≥32 chars) |
| `AUTH_ISSUER` / `AUTH_AUDIENCE` | Yes | JWT `iss` / `aud` claims |
| `GITHUB_CLIENT_ID` / `_SECRET` | Yes | GitHub OAuth |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Yes | Google OAuth |
| `MICROSOFT_CLIENT_ID` / `_SECRET` | Yes | Microsoft OAuth |
| `LOGICBRIDGE_HANDLER_DEK` | Recommended | AES key for encrypting connector handler code at rest |
| `SEAL_KMS_URL` | No | External KMS endpoint (defaults to local key store) |
| `ARCHIEVE_WAL_PATH` | No | Path for ARCHIEVE WAL queue DB (default: `./data/archieve/queue.db`) |
| `FORMKEY_CONSENT_CACHE_TTL_MS` | No | Consent cache TTL in ms (default: 60000; set 0 to disable) |
| `FORMKEY_RATE_LIMIT_MAX` | No | Max form submissions per rate-limit window per IP (default: 10) |
| `FORMKEY_RATE_LIMIT_WINDOW_MS` | No | Rate limit window duration in milliseconds (default: 60000) |
| `FORMKEY_SUBMISSION_RATE_LIMIT` | No | **Deprecated** — legacy alias for `FORMKEY_RATE_LIMIT_MAX`; still functional but prefer the new name |
| `FORMKEY_SEAL_VERIFY_ON_RENDER` | No | Verify SEAL before every render (default: true; never false in production) |
| `OPENAI_API_KEY` | AXIS | OpenAI provider for AXIS AI chat |
| `ANTHROPIC_API_KEY` | AXIS | Anthropic provider for AXIS AI chat |

---

## Deployment

| Target | Method | Notes |
|---|---|---|
| **LogicOS** | Cloudflare Pages | Auto-deploys on push to `97n8/LogicOS` main branch |
| **PuddleJumper** | Fly.io | `flyctl deploy -a publiclogic-puddlejumper` from `/Users/n8/puddlejumper/n8drive` |
| **Local PJ** | `npx tsx src/api/server.ts` | From `apps/puddlejumper/`; needs `JWT_SECRET`, `AUTH_ISSUER`, `AUTH_AUDIENCE` |

### PJ Deployment (quick reference)
```bash
cd /Users/n8/puddlejumper/n8drive
flyctl deploy -a publiclogic-puddlejumper
```

### Set a Fly.io secret
```bash
flyctl secrets set LOGICBRIDGE_HANDLER_DEK=$(openssl rand -base64 32) \
  -a publiclogic-puddlejumper
```

### Cold start behavior
Fly.io machines sleep after inactivity. First request after sleep takes 5–10 seconds. LogicOS handles this gracefully — the PJ health check will retry automatically.

---

*LogicOS v1.0 · PuddleJumper · PublicLogic LLC · os.publiclogic.org*
