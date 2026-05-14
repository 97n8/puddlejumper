# Module Builder Flow — Technical Specification

**Area:** Case Space  
**Status:** Draft — Pre-Implementation  
**Version:** 0.1.0  
**Date:** 2026-02-23  
**Author:** PublicLogic Architecture  
**Depends on:** [VAULT-CORE-SPEC.md](./VAULT-CORE-SPEC.md)

---

## Overview

This specification defines a single, reusable **Module Builder Flow** that produces ready-to-deploy VAULT Core process packages for any or all of the 9 standard governance modules. The builder starts with a town selector and uses the same step-by-step flow for every module, branching only where the module's statutory basis or workflow shape requires it.

The experience is **"choose your own adventure"**: the builder selects a town, picks which modules to build, and walks through each module's configuration path. LogicOS tools (statutory citation lookup, ARCHIEVE rules, authority maps, step editor, Tailored piece editor) are available at every step throughout the flow — not locked behind a post-build review.

The output is one or more deployable process packages (FormKeys + Tailored pieces) for the selected town, validated by PuddleJumper's governance engine before activation.

---

## Module Catalog

The 9 standard modules that this flow can produce (plus the Tailored piece as Piece 10):

| # | Module ID | Display Name | Domain Group | Primary Statutory Basis |
|---|-----------|-------------|--------------|------------------------|
| 1 | `VAULTPRR` | Public Records | Records & Compliance | M.G.L. c.66 §10 |
| 2 | `VAULTCLERK` | Town Clerk Operations | Records & Compliance | M.G.L. c.41 §§ 14–17 |
| 3 | `VAULTONBOARD` | Onboarding & HR | Onboarding & HR | M.G.L. c.149 §52C |
| 4 | `VAULTPERMIT` | Permitting | Permitting | M.G.L. c.143 §3 / 780 CMR |
| 5 | `VAULTFISCAL` | Financial Operations | Financial Operations | M.G.L. c.44 §§ 53–56 |
| 6 | `VAULTCODE` | Code Enforcement | Permitting | M.G.L. c.139 §§ 1–5 |
| 7 | `VAULTLEGAL` | Legal & Contracts | Records & Compliance | M.G.L. c.30B |
| 8 | `VAULTBOARD` | Board & Committee | Governance | M.G.L. c.30A §§ 18–25 |
| 9 | `VAULTOPS` | IT & Operations | Operations | Town Charter / IT Policy |
| 10 | `TAILORED` | Tailored Piece | (any) | Town-specific override layer |

---

## Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Module Builder Flow                                                         │
│                                                                              │
│  Step 0: Town Selector ──────────────────────────────────────────────────┐  │
│          Select municipality → loads tenant context from PJ backend       │  │
│                                                                           │  │
│  Step 1: Module Selector ────────────────────────────────────────────────┤  │
│          Pick one or many modules → creates a build queue                 │  │
│                                                                           │  │
│  For each module in the queue:                                            │  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  Step 2: Module Shell       ← same form, all modules               │  │  │
│  │     Title, description, statutory basis, retention class           │  │  │
│  │     [LogicOS: Citation Lookup] [LogicOS: Retention Guide]         │  │  │
│  │                                                                     │  │  │
│  │  Step 3: Workflow Steps     ← branching by module type             │  │  │
│  │     Add/remove/reorder steps (Gate, Route, Name, File, Notify…)   │  │  │
│  │     [LogicOS: Step Library] [LogicOS: ARCHIEVE Rules]             │  │  │
│  │                                                                     │  │  │
│  │  Step 4: Authority & Roles  ← same form, all modules               │  │  │
│  │     Approval chain, role mappings, separation-of-duty rules       │  │  │
│  │     [LogicOS: Authority Map] [LogicOS: Role Picker]               │  │  │
│  │                                                                     │  │  │
│  │  Step 5: Connectors         ← same form, all modules               │  │  │
│  │     Select connectors, configure auth, set retry policy            │  │  │
│  │     [LogicOS: Connector Library]                                   │  │  │
│  │                                                                     │  │  │
│  │  Step 6: Tailored Piece     ← optional, any module                 │  │  │
│  │     Override SLAs, role titles, encryption, deviations            │  │  │
│  │     [LogicOS: Tailored Editor] [LogicOS: Legal Signoff]           │  │  │
│  │                                                                     │  │  │
│  │  Step 7: Review & Validate  ← same gate, all modules               │  │  │
│  │     PJ governance validation → fix blockers → activate            │  │  │
│  │     [LogicOS: Validation Panel]                                    │  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │  │
│          ↓  (advance to next module in queue or end)                      │  │
│                                                                           │  │
│  Step 8: Build Summary ─────────────────────────────────────────────────┘  │
│          All modules built → deploy all or selectively                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

The key design principle: **Steps 2–7 are the same form skeleton for every module.** Only Step 3 (Workflow Steps) branches with module-specific defaults. The builder never has to learn a new flow for each module.

---

## Step 0 — Town Selector

**Purpose:** Establish the municipality context. Every downstream step is scoped to this tenant.

### UI

A single search-and-select input pre-populated from the builder's authorized tenant list (from PJ `/api/identity`). If the builder has multi-tenant scope, all their authorized towns appear. If single-tenant, Step 0 is skipped and the town is pre-filled.

```
┌─────────────────────────────────────────────────────────┐
│  Which town are you building for?                        │
│                                                          │
│  [ 🔍 Search municipalities...                        ]  │
│                                                          │
│  ● Concord, MA                  ✓ Authorized             │
│  ○ Acton, MA                    ✓ Authorized             │
│  ○ Maynard, MA                  ✓ Authorized             │
│                                                          │
│  Town: Concord, MA                                       │
│  Tenant ID: concord-ma                                   │
│  Active VAULT Core Version: 2.0.0                        │
│  Existing modules: VAULTPRR, VAULTCLERK                  │
│  Missing modules: VAULTPERMIT, VAULTONBOARD, +5          │
│                                                          │
│                           [ Continue → ]                 │
└─────────────────────────────────────────────────────────┘
```

### Data loaded at Step 0

From `GET /api/identity`:
- `tenantId`, `tenantName`
- `authorizedScopes` — which tenants this builder can act for

From `GET /api/v1/vault/processes?tenantScope={tenantId}` (Vault):
- List of already-deployed modules for this town
- Highlights which of the 9 modules are missing → pre-selects them in Step 1

### Constraints

- Town selection is immutable for the rest of the build session. A "Change town" action restarts the flow from Step 0.
- Builder must have `role: "admin"` or `role: "deployer"` for the selected tenant. Viewers and Operators see read-only previews only.

---

## Step 1 — Module Selector

**Purpose:** Choose which modules to build in this session. Creates the build queue.

### UI

A checklist of all 9 modules. Modules already deployed for this town are checked and grayed out (already active). Missing modules are pre-checked. Builder can uncheck any module to skip it, or add previously deployed modules for re-configuration.

```
┌─────────────────────────────────────────────────────────┐
│  Concord, MA — Select modules to build                   │
│                                                          │
│  ✅ VAULTPRR   Public Records       [Already deployed]   │
│  ✅ VAULTCLERK Town Clerk Ops       [Already deployed]   │
│                                                          │
│  ☑  VAULTONBOARD  Onboarding & HR   [New]               │
│  ☑  VAULTPERMIT   Permitting        [New]               │
│  ☑  VAULTFISCAL   Financial Ops     [New]               │
│  ☐  VAULTCODE     Code Enforcement  (skip for now)      │
│  ☐  VAULTLEGAL    Legal & Contracts (skip for now)      │
│  ☐  VAULTBOARD    Board & Committee (skip for now)      │
│  ☐  VAULTOPS      IT & Operations   (skip for now)      │
│                                                          │
│  📦 Build queue: 3 modules                               │
│  Estimated time: ~15 minutes                             │
│                                                          │
│  [ ← Back ]                     [ Start Building → ]    │
└─────────────────────────────────────────────────────────┘
```

### Build queue

The checked modules are added to an ordered build queue. The builder works through them one at a time. Progress is shown as a breadcrumb trail at the top of every subsequent step:

```
Town: Concord, MA  │  Onboarding & HR [1/3]  │  Step 3 of 7: Workflow Steps
```

The builder can jump back to any completed module in the queue by clicking its breadcrumb. Completed modules show a green checkmark; the active module is highlighted; future modules are grayed out.

---

## Step 2 — Module Shell

**Purpose:** Set the module's core metadata. Same form for every module.

### Fields

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `id` | Yes | Auto-generated from module ID + town slug | e.g. `vaultonboard-concord-ma` |
| `version` | Yes | `1.0.0` | SemVer; auto-incremented if re-configuring existing module |
| `title` | Yes | Module display name | e.g. "Onboarding & HR — Concord, MA" |
| `description` | Yes | Module default description | Editable; one sentence, trigger → outcome |
| `statutory_basis` | Yes | Module primary statute | **Must be set before advancing to Step 3** |
| `retention_class` | Yes | Module default | `permanent | 7-year | 3-year | 1-year | custom` |
| `requires_compliance_review` | Yes | `false` | Set `true` for VAULTLEGAL, VAULTFISCAL |
| `formKey` | Auto | `{moduleId}.{townSlug}.v{major}` | e.g. `vaultonboard.concord-ma.v1` |

### LogicOS tools available at Step 2

- **Citation Lookup** — search M.G.L. by chapter/section or keyword. Returns citation text and URL, pre-fills `statutory_basis`.
- **Retention Guide** — shows the standard retention class for each document type produced by this module. Auto-suggests `retention_class` from the module default.

### Blocker: No statutory basis, no advance

If `statutory_basis` is empty or invalid, the "Next" button is disabled and a banner reads:

> **Governance block:** Every module must have a documented statutory basis or policy citation. PuddleJumper cannot validate or activate an automation without it. Use Citation Lookup to find the right M.G.L. reference.

---

## Step 3 — Workflow Steps

**Purpose:** Define the ordered steps (Gate, Route, Name, File, Notify, Escalate, Lock, Clock, Generate, Archive, Export) for this module. This is the only step that branches by module type.

### Shared step editor (all modules)

Each step has:

```
┌─────────────────────────────────────────────────────────┐
│  Step 2 of 5 — Route                                     │
│                                                          │
│  Label:        [ Route to HR Director              ]     │
│  Description:  [ Move case to HR queue based on    ]     │
│                [ authority map                     ]     │
│  Target:       [ sharepoint:concord-ma:/hr/onboard ]     │
│  Role required:[ dept_head → HR Director           ]     │
│                                                          │
│  ARCHIEVE rules:                                         │
│    Naming:     [ HIRE-{YYYY}-{SEQ}                 ]     │
│    Retention:  [ 7-year                            ]     │
│    Access:     [ INTERNAL                          ]     │
│                                                          │
│  [LogicOS: ARCHIEVE Rules] [LogicOS: Role Picker]        │
│                                                          │
│  [ + Add step below ]  [ × Remove step ]                 │
└─────────────────────────────────────────────────────────┘
```

### Module-specific default step templates

Each module ships with a default step sequence. The builder can add, remove, and reorder steps, but cannot delete a step marked `required: true` without providing a documented justification (recorded in the Tailored piece's `approvedDeviations`).

#### VAULTPRR — Public Records Request

| # | Type | Label | Required | M.G.L. |
|---|------|-------|----------|--------|
| 1 | Gate | Verify requester identity | No | c.66 §10 |
| 2 | Name | Apply ARCHIEVE naming (PRR-YYYY-SEQ) | **Yes** | c.66 §10 |
| 3 | Clock | Start 10-day statutory clock | **Yes** | c.66 §10(b) |
| 4 | Route | Route to Records Custodian | **Yes** | c.66 §10 |
| 5 | Gate | Exemption review decision | **Yes** | c.66 §10(c) |
| 6 | Generate | Create response letter | **Yes** | c.66 §10 |
| 7 | Notify | Notify requester of decision | **Yes** | c.66 §10 |
| 8 | File | File to SharePoint Records library | **Yes** | c.66 §10 |
| 9 | Lock | SNAP seal on terminal state | **Yes** | c.66 §10 |

#### VAULTCLERK — Town Clerk Operations

| # | Type | Label | Required | M.G.L. |
|---|------|-------|----------|--------|
| 1 | Gate | Verify filer eligibility | **Yes** | c.41 §14 |
| 2 | Name | Apply naming convention | **Yes** | c.41 §17 |
| 3 | File | File in official records library | **Yes** | c.41 §17 |
| 4 | Notify | Confirm filing to filer | No | — |
| 5 | Lock | Seal record upon certification | **Yes** | c.41 §17 |

#### VAULTONBOARD — Onboarding & HR

| # | Type | Label | Required | M.G.L. |
|---|------|-------|----------|--------|
| 1 | Gate | Background check clearance | **Yes** | c.149 §52C |
| 2 | Route | Route hire paperwork to HR | **Yes** | c.149 §52C |
| 3 | Clock | Start probation period clock | No | — |
| 4 | Generate | Generate offer letter (PDF-A) | **Yes** | c.149 §52C |
| 5 | Notify | Send offer to candidate | **Yes** | — |
| 6 | Gate | Acceptance confirmation | **Yes** | — |
| 7 | File | File to personnel records | **Yes** | c.149 §52C |
| 8 | Lock | Seal onboarding record | **Yes** | — |

#### VAULTPERMIT — Permitting

| # | Type | Label | Required | M.G.L. |
|---|------|-------|----------|--------|
| 1 | Gate | Application completeness check | **Yes** | 780 CMR 110.3 |
| 2 | Name | Apply permit naming (PERMIT-YYYY-SEQ) | **Yes** | 780 CMR |
| 3 | Route | Route to Building Inspector | **Yes** | c.143 §3 |
| 4 | Gate | Building Inspector decision | **Yes** | c.143 §3 |
| 5 | Route | Route to Zoning Board (conditional) | No | Local bylaw |
| 6 | Generate | Generate permit or denial letter | **Yes** | 780 CMR |
| 7 | Notify | Notify applicant of decision | **Yes** | — |
| 8 | File | File to permit records | **Yes** | c.143 §3 |
| 9 | Lock | Seal upon final decision | **Yes** | — |

#### VAULTFISCAL — Financial Operations

| # | Type | Label | Required | M.G.L. |
|---|------|-------|----------|--------|
| 1 | Gate | Expenditure authority check | **Yes** | c.44 §53 |
| 2 | Gate | Budget cap validation | **Yes** | c.44 §56 |
| 3 | Route | Route invoice to department head | **Yes** | c.44 §53 |
| 4 | Gate | Department head approval | **Yes** | c.44 §53 |
| 5 | Route | Route to Town Accountant | **Yes** | c.41 §52 |
| 6 | Gate | Accountant certification | **Yes** | c.41 §52 |
| 7 | File | File to warrant file | **Yes** | c.44 §§ 53–56 |
| 8 | Lock | Seal upon payment | **Yes** | c.44 §53 |

#### VAULTCODE — Code Enforcement

| # | Type | Label | Required | M.G.L. |
|---|------|-------|----------|--------|
| 1 | Gate | Complaint validation | No | c.139 §1 |
| 2 | Route | Route to Code Enforcement Officer | **Yes** | c.139 §5 |
| 3 | Clock | Start response clock | **Yes** | c.139 §5 |
| 4 | Gate | Inspector finding gate | **Yes** | c.139 §5 |
| 5 | Notify | Issue violation notice | **Yes** | c.139 §5 |
| 6 | Escalate | Escalate if unremediated (day 30) | **Yes** | c.139 §5 |
| 7 | Lock | Seal upon resolution | **Yes** | — |

#### VAULTLEGAL — Legal & Contracts

| # | Type | Label | Required | M.G.L. |
|---|------|-------|----------|--------|
| 1 | Gate | Procurement threshold check | **Yes** | c.30B §5 |
| 2 | Route | Route to Town Counsel | **Yes** | c.30B §17 |
| 3 | Gate | Legal review approval | **Yes** | c.30B |
| 4 | Generate | Generate contract execution copy | **Yes** | c.30B §17 |
| 5 | File | File executed contract | **Yes** | c.30B §17 |
| 6 | Lock | Seal upon execution | **Yes** | c.30B |

#### VAULTBOARD — Board & Committee

| # | Type | Label | Required | M.G.L. |
|---|------|-------|----------|--------|
| 1 | Gate | Open Meeting Law compliance check | **Yes** | c.30A §20 |
| 2 | Notify | Post agenda (48-hour advance) | **Yes** | c.30A §20 |
| 3 | Generate | Generate meeting minutes template | **Yes** | c.30A §22 |
| 4 | Gate | Minutes approval by board | **Yes** | c.30A §22 |
| 5 | File | File approved minutes | **Yes** | c.30A §22 |
| 6 | Lock | Seal upon certification | **Yes** | c.30A §22 |

#### VAULTOPS — IT & Operations

| # | Type | Label | Required | Basis |
|---|------|-------|----------|-------|
| 1 | Gate | Change advisory board approval | **Yes** | IT Policy |
| 2 | Gate | Drift check (canonical comparison) | **Yes** | IT Policy |
| 3 | Route | Route to System Administrator | **Yes** | IT Policy |
| 4 | Gate | Pre-deployment smoke test | **Yes** | IT Policy |
| 5 | Archive | Snapshot environment before change | **Yes** | IT Policy |
| 6 | Lock | Seal change record | **Yes** | IT Policy |

### LogicOS tools available at Step 3

- **Step Library** — a searchable panel of all step types with descriptions, when to use each, and example configurations. Drag or click to insert a step at the cursor position.
- **ARCHIEVE Rules** — shows the standard naming pattern, retention class, and access level for the document type produced by the highlighted step. Pre-fills the step's `archieve_rules` block.
- **Role Picker** — lists all roles defined in the town's authority map (loaded from Vault at Step 0). Clicking a role fills `role_required` for the current step.
- **Statutory Annotator** — highlight any step label and look up which M.G.L. section governs it. Appends citation to the step's `mglCitation` field.

---

## Step 4 — Authority & Roles

**Purpose:** Define the approval chain and role bindings for this module. Same form for every module.

### Fields

```jsonc
{
  "approvalChain": [
    {
      "stepLabel": "Department Head Approval",
      "requiredRole": "dept_head",
      "order": 1,
      "parallel": false,
      "timeoutSeconds": 86400,
      "escalateTo": "admin",
      "escalateAfterSeconds": 72000
    },
    {
      "stepLabel": "Legal Review",
      "requiredRole": "legal",
      "order": 2,
      "parallel": false,
      "timeoutSeconds": 86400,
      "escalateTo": "admin",
      "escalateAfterSeconds": 72000
    }
  ],
  "selfApprovalProhibited": true,
  "separationOfDuty": [
    "submitter != approver",
    "legal cannot approve own legal_review step"
  ]
}
```

### Authority map integration

The right side of Step 4 shows the town's current authority map (from `GET /api/v1/vault/formkey/{key}` + Tailored piece role mappings). The builder drags roles from the authority map into the chain, or types a role name to search.

If the town's authority map does not include a required role (e.g., `legal` is not yet mapped for this town), a warning appears:

> **Missing role mapping:** The `legal` role is required by this module but has not been mapped to a local title and email for Concord, MA. Add it in the Tailored Piece (Step 6) before activating.

### LogicOS tools available at Step 4

- **Authority Map** — visual graph of the town's current role hierarchy, showing who reports to whom and who can delegate.
- **Role Picker** — same as Step 3; lists available roles and their local mappings.

---

## Step 5 — Connectors

**Purpose:** Select and configure the connectors this module will use. Same form for every module.

### UI

A two-column layout: left shows the connector library; right shows the module's active connector list.

```
┌────────────────────────────────┬────────────────────────────────┐
│  Connector Library              │  Active for VAULTONBOARD       │
│                                 │                                │
│  📧 Email               [+ Add] │  📧 Email                      │
│  📁 SharePoint          [+ Add] │     From: no-reply@concord.ma  │
│  ⚡ Power Automate      [+ Add] │     Auth: Graph API            │
│  👤 Azure AD / Entra    [+ Add] │     Retry: 3× exp backoff      │
│  📋 CivicPlus           [+ Add] │                                │
│  🐙 GitHub              [+ Add] │  📁 SharePoint                 │
│  🔑 Azure Key Vault     [+ Add] │     Library: /hr/onboard       │
│  💳 Payment             [+ Add] │     Auth: App Registration     │
│                                 │     Retry: 3× exp backoff      │
│                                 │                                │
└────────────────────────────────┴────────────────────────────────┘
```

Each connector card in the active list shows:
- **Auth method** (`bearer`, `hmac`, `oauth2`) and token source (`pj-runtime` or `vauly-secret`)
- **Retry policy** (max attempts, base delay, backpressure mode)
- **Webhook events** emitted by this connector for this module
- **Error codes** and which are retryable

### Module-specific connector defaults

| Module | Default connectors |
|--------|--------------------|
| VAULTPRR | email, sharepoint |
| VAULTCLERK | sharepoint |
| VAULTONBOARD | email, sharepoint, aad |
| VAULTPERMIT | email, sharepoint, github |
| VAULTFISCAL | email, sharepoint |
| VAULTCODE | email, sharepoint |
| VAULTLEGAL | email, sharepoint |
| VAULTBOARD | email, sharepoint |
| VAULTOPS | github, sharepoint |

### LogicOS tools available at Step 5

- **Connector Library** — full connector reference with auth setup instructions, webhook event catalog, and error code table. Accessible as a side panel; clicking a connector in the library adds it to the active list.

---

## Step 6 — Tailored Piece (Optional)

**Purpose:** Apply town-specific overrides to this module. Can be skipped; the module deploys with Core defaults if skipped.

This step is the visual interface for the Tailored piece schema defined in [VAULT-CORE-SPEC.md §2](./VAULT-CORE-SPEC.md). All fields map 1:1 to that schema.

### UI tabs

```
┌─────────────────────────────────────────────────────────┐
│  Tailored Piece — VAULTONBOARD / Concord, MA             │
│                                                          │
│  [SLA Overrides] [Role Mappings] [Connectors] [Deviations] [Encryption]
│                                                          │
│  ── SLA Overrides ───────────────────────────────────────│
│  Core default: Background check response: 30 days        │
│                                                          │
│  ☑ Override SLA for this module                         │
│  Background check response: [ 14 ] days                  │
│  Justification: [ Town Counsel Memo 2026-01-15       ]   │
│                                                          │
│  ── Enforcement mode ────────────────────────────────────│
│  ● Apply Tailored overrides (Core fills gaps)            │
│  ○ Use Core rules only (ignore all overrides)            │
│                                                          │
│  [LogicOS: Tailored Editor] [LogicOS: Legal Signoff]     │
└─────────────────────────────────────────────────────────┘
```

### Enforcement mode toggle

The toggle ("Apply Tailored" vs "Use Core only") is shown prominently. Changing it writes an audit entry immediately (before the builder leaves Step 6). A banner confirms:

> **Audit recorded:** Enforcement mode changed from `tailored` to `core` for VAULTONBOARD / Concord, MA. This change is logged in the VAULT Core audit ledger.

### LogicOS tools available at Step 6

- **Tailored Editor** — validates the Tailored piece JSON in real-time, highlights schema violations, and suggests fixes.
- **Legal Signoff** — a structured form for recording the Town Counsel sign-off on deviations. Produces the `legalSignoff` block. Required before any deviation can be saved.
- **Deviation History** — shows all approved deviations for this town+module, with expiry dates highlighted.

---

## Step 7 — Review & Validate

**Purpose:** Run PuddleJumper's governance validation before activation. Same gate for every module.

### Validation checks run

| Check | Pass | Fail action |
|-------|------|-------------|
| `statutory_basis` present and valid citation format | ✅ | Block: fix required |
| All required steps present | ✅ | Block: show missing steps |
| No orphan stage references | ✅ | Block: highlight orphan |
| No circular approval route | ✅ | Block: show cycle |
| No SLA conflict with Tailored piece | ✅ | Block: show conflict |
| No stop-rule contradiction | ✅ | Block: show contradiction |
| All required role mappings set | ✅ | Warning: link to Step 4 |
| Legal signoff present for all deviations | ✅ | Block: link to Step 6 |
| FormKey not already registered (or version incremented) | ✅ | Block: suggest version bump |
| Anti-dependency check: no vendor-lock outputs | ✅ | Warning: show affected steps |

### UI

```
┌─────────────────────────────────────────────────────────┐
│  Review — VAULTONBOARD / Concord, MA                     │
│                                                          │
│  ✅ Statutory basis: M.G.L. c.149 §52C                   │
│  ✅ 8 steps valid, no orphans                            │
│  ✅ Approval chain: dept_head → legal (sequential)       │
│  ✅ SLA: 14 days (Tailored override, signed by Counsel)  │
│  ⚠️  Role mapping: `legal` not locally titled            │
│     → Add local title in Tailored Piece [Fix →]          │
│  ✅ No circular routes                                   │
│  ✅ No stop-rule contradictions                          │
│  ✅ Anti-dependency: all outputs are portable            │
│                                                          │
│  Status: READY (1 warning — can activate with warning)   │
│                                                          │
│  [← Back to fix]        [Activate & continue →]         │
└─────────────────────────────────────────────────────────┘
```

### Activation

Clicking "Activate & continue" calls:

1. `POST /api/v1/vault/manifests/register` — registers the process package manifest
2. `POST /api/v1/vault/authorize-release` — requests release authorization (requires approval chain completion in PJ if `requires_compliance_review: true`)
3. Vauly API `POST /vauly/v1/seal/init` — initializes the SEAL chain for this FormKey
4. Vauly API `POST /vauly/v1/keys/generate` — generates the at-rest encryption key for this module

On success:
- Module status changes to `active` in the build queue breadcrumb
- Flow advances to the next module in the queue, or to Step 8 if queue is empty

On failure:
- Error message from the failing step is shown inline
- Builder stays on Step 7; blockers must be resolved before retry

### LogicOS tools available at Step 7

- **Validation Panel** — expands each check to show the full validation result, the rule it's checking, and (for failures) a link directly to the form field that needs fixing.

---

## Step 8 — Build Summary

**Purpose:** Overview of everything built in this session. Offers deploy-all or selective deployment.

### UI

```
┌─────────────────────────────────────────────────────────┐
│  Build Summary — Concord, MA                             │
│                                                          │
│  ✅ VAULTONBOARD  Onboarding & HR    v1.0.0  [Active]   │
│  ✅ VAULTPERMIT   Permitting         v1.0.0  [Active]   │
│  ✅ VAULTFISCAL   Financial Ops      v1.0.0  [Active]   │
│                                                          │
│  Total: 3 modules built and activated                    │
│  SEAL chain initialized for all 3 FormKeys              │
│  Encryption keys generated and escrowed                  │
│                                                          │
│  ── Deployment Checklist ──────────────────────────────  │
│  ✅ PJ smoke test: all 3 modules pass /health            │
│  ✅ Vauly SEAL init confirmed                            │
│  ✅ Vauly key escrow confirmed                           │
│  ⚠️  Connector auth test: VAULTPERMIT GitHub pending     │
│  ✅ Training docs: USER_QUICKREF updated                 │
│                                                          │
│  [📋 Export build report]  [🔄 Build more modules]       │
│  [← Return to dashboard]                                 │
└─────────────────────────────────────────────────────────┘
```

### Build report export

Clicking "Export build report" produces a JSON artifact:

```jsonc
{
  "buildId": "build-concord-ma-20260223-001",
  "tenantId": "concord-ma",
  "builtAt": "2026-02-23T21:00:00Z",
  "builtBy": "builder@publiclogic.org",
  "modules": [
    {
      "moduleId": "VAULTONBOARD",
      "formKey": "vaultonboard.concord-ma.v1",
      "version": "1.0.0",
      "sealId": "seal-vaultonboard.concord-ma.v1-20260223",
      "status": "active",
      "tailoredPieceId": "tailored-concord-ma-vaultonboard.concord-ma.v1-1.0.0",
      "deploymentChecklist": {
        "pjSmokeTest": true,
        "vaulySealInit": true,
        "vaulyKeyEscrow": true,
        "connectorAuthTest": true,
        "trainingDocsUpdated": true
      }
    }
  ]
}
```

This artifact is sealed by the Vauly API (`POST /vauly/v1/sign`) and stored in the tenant's ARCHIEVE.

---

## LogicOS Tool Inventory

These tools are available throughout the flow (Steps 2–7). They appear as a collapsible right-side panel accessible via a toolbar icon at any step.

| Tool | Icon | Available at | Description |
|------|------|-------------|-------------|
| Citation Lookup | ⚖️ | Steps 2, 3 | Search M.G.L. by chapter/section/keyword. Returns citation text, URL, context. Pre-fills `statutory_basis` or step `mglCitation`. |
| Retention Guide | 📁 | Steps 2, 3 | Shows standard retention class for each document type. Auto-suggests `retention_class`. |
| Step Library | 📚 | Step 3 | Searchable catalog of all step types with descriptions, use-cases, and example configs. |
| ARCHIEVE Rules | 📋 | Step 3 | Shows naming pattern, retention class, and access level for the document produced by the highlighted step. |
| Role Picker | 👤 | Steps 3, 4 | Lists all roles in the town's authority map. Clicking inserts the role into the current field. |
| Statutory Annotator | 🔖 | Step 3 | Highlight a step label → looks up the M.G.L. section that governs it. |
| Authority Map | 🗺️ | Step 4 | Visual graph of the town's role hierarchy. Drag roles into the approval chain. |
| Connector Library | 🔌 | Step 5 | Full connector reference with auth setup, webhook events, error codes. |
| Tailored Editor | ✏️ | Step 6 | Real-time schema validator for the Tailored piece JSON. |
| Legal Signoff | 📝 | Step 6 | Structured form for Town Counsel sign-off on deviations. |
| Deviation History | 🕐 | Step 6 | All approved deviations for this town+module, with expiry highlights. |
| Validation Panel | ✅ | Step 7 | Expanded view of each governance check, with links to fields needing fixes. |

### LogicOS tool API contract

Each tool calls a corresponding read-only backend endpoint. Tools are always GET requests; they never mutate state. This means a builder can open any tool at any time without accidentally changing the module under construction.

| Tool | Endpoint |
|------|----------|
| Citation Lookup | `GET /api/v1/vault/mgl/search?q={query}` |
| Retention Guide | `GET /api/v1/vault/retention/suggest?docType={type}` |
| Step Library | `GET /api/v1/vault/steps/catalog` |
| ARCHIEVE Rules | `GET /api/v1/vault/archieve/rules?docType={type}` |
| Role Picker | `GET /api/v1/vault/roles?tenantId={tenantId}` |
| Authority Map | `GET /api/v1/vault/authority-map?tenantId={tenantId}` |
| Connector Library | `GET /api/v1/vault/connectors/catalog` |
| Tailored Editor | Validates client-side (Zod schema) + `POST /api/v1/vault/tailored/validate` |
| Legal Signoff | `POST /api/v1/vault/tailored/signoff` (write — only on explicit save) |
| Deviation History | `GET /api/v1/vault/tailored/deviations?tenantId={tenantId}&formKey={key}` |
| Validation Panel | `POST /api/v1/vault/manifests/validate` (dry-run, no registration) |

---

## "Choose Your Own Adventure" Branches

The flow supports non-linear navigation within the module queue and within each module's steps. The following branches are explicitly supported:

### Branch A: Re-configure an existing module

If the builder selects an already-deployed module in Step 1, the flow loads the existing module's configuration into Steps 2–6, pre-filled. The version is auto-incremented. The builder can change any field and re-activate; this produces a new FormKey version and extends the SEAL chain.

### Branch B: Skip a step

The builder can advance from any step to any later step. Skipped steps are marked with a warning indicator in the breadcrumb. PuddleJumper's validation (Step 7) catches anything that was required in the skipped step.

### Branch C: Jump back mid-queue

The builder can click any previously completed module in the queue breadcrumb and go back to re-configure it. The flow re-opens at Step 7 (Review & Validate) for that module, with the existing configuration pre-filled.

### Branch D: Add a module to the queue mid-flow

At any point in the flow, the builder can click "Add module" to return to Step 1 and check additional modules. The new modules are appended to the end of the queue. The builder's progress on in-flight modules is preserved.

### Branch E: Tailored piece propagation

If the builder creates a Tailored piece for one module (e.g., VAULTPRR), they can copy it to other modules in the queue. A "Copy Tailored piece to…" button in Step 6 opens a checklist of other modules in the queue and applies the same SLA overrides, role mappings, and encryption policy. Module-specific fields (deviations, connector overrides) are not copied — only fields that are module-agnostic.

---

## Backend API Changes Required

To support the Module Builder Flow, the following new endpoints are needed in VAULT Core. None of these exist today; all are net-new additions.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/vault/mgl/search` | Citation lookup by keyword or citation string |
| GET | `/api/v1/vault/retention/suggest` | Retention class suggestion by document type |
| GET | `/api/v1/vault/steps/catalog` | Step type catalog with descriptions and examples |
| GET | `/api/v1/vault/archieve/rules` | ARCHIEVE naming/retention/access rules by doc type |
| GET | `/api/v1/vault/roles` | Role list for a tenant (from authority map) |
| GET | `/api/v1/vault/authority-map` | Full authority map for a tenant |
| GET | `/api/v1/vault/connectors/catalog` | Connector library with auth, events, error codes |
| POST | `/api/v1/vault/tailored/validate` | Dry-run validation of a Tailored piece (no write) |
| POST | `/api/v1/vault/tailored/signoff` | Record legal signoff for a deviation |
| GET | `/api/v1/vault/tailored/deviations` | List approved deviations for a tenant+formKey |
| POST | `/api/v1/vault/manifests/validate` | Dry-run manifest validation (no registration) |

All existing endpoints (`/api/v1/vault/manifests/register`, `/api/v1/vault/authorize-release`, `/api/v1/vault/audit`, etc.) are reused without modification.

---

## State Management

The builder flow state is managed by the PJ backend (not client localStorage). At any point, the builder can close the browser and return to find their session intact.

### Session record

```typescript
interface BuilderSession {
  sessionId: string;           // ulid
  tenantId: string;
  builderId: string;           // builder's userId from PJ
  startedAt: string;           // ISO 8601
  queue: BuilderQueueItem[];
  currentModuleIndex: number;
  currentStep: number;         // 2–7
}

interface BuilderQueueItem {
  moduleId: string;            // e.g. "VAULTONBOARD"
  status: "pending" | "in-progress" | "complete" | "error";
  formKey?: string;            // set after Step 2
  tailoredPieceId?: string;   // set after Step 6, if used
  activatedAt?: string;        // set after Step 7 succeeds
  draftPayload: ProcessPackageDraft;  // the module being built
}
```

Sessions are stored in the PJ SQLite database (`builder_sessions` table, WAL mode). Completed sessions are archived to ARCHIEVE after 30 days.

---

## Out of Scope (This Spec)

| Item | Reason |
|------|--------|
| Visual flow canvas (drag-and-drop) | Builder is structured form, not canvas. See product system prompt §3. |
| AI/LLM step suggestions | Non-deterministic, non-auditable. See ARCHITECTURE-NORTH-STAR.md §6. |
| Custom module creation (outside the 9 + Tailored) | Custom modules are a future feature. The 9 standard + Tailored cover all current municipal needs. |
| Builder access for Viewer/Operator roles | Builder requires Admin or Deployer. Lower roles use the Automations library (read-only). |
| Multi-town batch builds | One town per session. Multi-town is a future feature for operators with large portfolios. |
