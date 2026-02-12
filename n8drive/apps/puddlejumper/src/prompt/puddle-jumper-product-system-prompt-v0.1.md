# PuddleJumper - Product & System Prompt

**Version:** 0.1  
**Date:** February 11, 2026  
**Author:** PublicLogic LLC  
**Classification:** Internal / Engineering

---

## What This Is

PuddleJumper is a governed automation workspace for Massachusetts municipal operations. It is the operational layer between the Veritas Portal (where operators configure and deploy canonical governance structures) and the town's M365 environment (where work actually happens).

Think: if someone combined Zapier's automation library, Apple Shortcuts' composability, Power Automate's enterprise connectors, and a compliance-first government operating model - but the governance was not bolted on afterward, it was the substrate everything runs on.

PuddleJumper is not a remote control. It is not a dashboard. It is a **workspace you live in** - you browse, build, trigger, monitor, and audit automations that carry statutory authority and produce defensible records.

## What This Is Not

- Not a drag-and-drop builder for arbitrary automations. Every automation must trace to a statutory basis or documented policy.
- Not a general-purpose iPaaS. The connector inventory is bounded to what municipalities actually use.
- Not self-service for end users. Operators (credentialed PublicLogic staff or authorized municipal administrators) configure; towns operate within the structures created.
- Not a monitoring dashboard. Activity is a receipt log, not a real-time operations center.
- Not decorative compliance. The governance layer enforces - it does not just display.

## Core Constraint

No automation executes unless:

1. The workspace is **chartered** (authority, accountability, boundary, continuity confirmed)
2. The action has a **documented trigger** with a statutory or policy basis
3. The output conforms to **ARCHIEVE rules** (naming, retention, routing)
4. The operator who configured it **recorded intent**

If any of these are missing, PuddleJumper blocks execution and logs the attempt. This is not optional. This is the product.

---

## Identity & Permissions

PuddleJumper does not hardcode tenant context. On load, it:

1. Resolves the operator's identity from the backend (Azure AD / Entra)
2. Returns their role, credential level, and authorized tenant scope
3. Renders only the automations, tenants, and actions they are permitted to see

The UI never displays a town name until the backend provides it. The operator's initials, role line (e.g., "Operator - MCPPO - Full Deploy"), and tenant count are the only identity surface. Tenant switching is available if the operator has multi-tenant scope.

**Permission levels** (resolved from backend, never hardcoded):

| Level | Can Do |
|---|---|
| Viewer | Browse automations, view activity, read logs |
| Operator | Run existing automations, export evidence packets |
| Deployer | Deploy modules, provision environments, run drift checks |
| Admin | Edit automations, create new automations, manage authority maps |

---

## Information Architecture

PuddleJumper has three primary views, accessible via tabs:

### 1. Automations (Library)

The main view. A searchable, browseable library of every automation configured for the active tenant.

**Grouping:** Automations are grouped by domain. Default groups:
- Records & Compliance (PRR intake, document filing, evidence export, retention)
- Onboarding & HR (hire intake, probation review, separation, access provisioning)
- Permitting (application intake, hearing scheduling, inspection tracking)
- Financial Operations (invoice routing, budget checks, payment processing)
- Operations (site provisioning, drift checks, module deploys, healthchecks)

Groups are derived from the module taxonomy - they are not arbitrary categories. If a VAULT module exists, its automations appear under the corresponding group.

**Card anatomy:**

Each automation card displays:
- **Icon** - visual identifier (emoji or custom)
- **Name** - human-readable, action-oriented (e.g., "PRR Intake & Routing")
- **Description** - one line: trigger -> outcome (e.g., "Form submission -> auto-name -> route to custodian -> start 10-day clock")
- **Tags** - module name (e.g., VAULTPRR) and statutory citations (e.g., M.G.L. c.66 6A). Statutory tags are visually distinct.
- **Status badge** - Active (green), Gate (amber, something needs human decision), Blocked (red, precondition unmet), Draft (gray, not yet deployed)
- **Last run** - relative time
- **Chevron** - indicates tappable for detail

**Search:** Filters across automation names, descriptions, tags, and statutory citations. Searching "c.66" surfaces all automations governed by that statute. Searching "retention" surfaces anything that sets a CLOCK. Search is instant, client-side over the loaded library.

**Detail sheet:** Tapping a card opens a bottom-sheet showing the full step chain:

Each step has:
- **Type indicator** - Trigger (blue), Gate (amber), Action (green), End (purple)
- **Step number** - sequential
- **Label** - what happens (e.g., "Start 10-Day Clock")
- **Description** - how it works (e.g., "CLOCK anchor - M.G.L. c.66 6A statutory deadline")
- **Meta** - implementation reference (e.g., "Timer: 10 business days - escalate at day 7")
- **Vertical connector line** - steps are visually chained

Steps are connected by a vertical line showing the flow. Gate steps are visually distinct because they represent points where execution may stop and wait for human input.

Detail sheet actions:
- **Edit** - opens step editor (Admin only)
- **Logs** - shows execution history for this automation
- **Run Now** - manually trigger (requires intent statement if operator-initiated)

### 2. Activity (Feed)

A chronological feed of everything that happened across all automations for the active tenant.

Each activity item shows:
- **Status dot** - green (success), blue (info), amber (warning), red (failure)
- **Description** - what happened, with bold entity references (e.g., "**PRR-2026-0047** routed to Records Custodian - 10-day clock started")
- **Relative time**

Activity items are not interactive in v1. They are receipts, not action items. If a gate needs attention, it surfaces in the Automations tab as an amber badge - not in the activity feed.

No pagination in v1. Load the most recent 50 items. Older history is accessible through the audit log (separate from PuddleJumper, lives in the Veritas Portal).

### 3. Builder

Where operators (Admin level) create new automations.

**Builder is not a visual canvas.** It is a structured form:

1. **Choose trigger type:**
   - Form submission (CivicPlus, SharePoint, API)
   - Timer expiration (statutory deadline, renewal, probation)
   - State transition (CASE state machine move)
   - Calendar event (scheduled governance action)
   - Manual (operator-initiated with required intent)
   - Drift detection (canonical comparison)
   - External webhook (inbound from connected system)

2. **Add steps:** Each step is one of:
   - **Gate** - block until condition is met (authority exists, approval received, clearance passed)
   - **Route** - move document/case to person or queue based on authority map
   - **Name** - apply ARCHIEVE naming convention
   - **File** - place in correct library/folder per retention schedule
   - **Notify** - structured notification (case ID, deadline, required action, authority reference)
   - **Escalate** - time-based escalation at configurable thresholds (50%, 75%, 100% of deadline)
   - **Lock** - SNAP seal when case reaches terminal state
   - **Clock** - bind CLOCK retention anchor
   - **Generate** - create templated document (offer letter, response letter, certificate, PDF-A)
   - **Archive** - move to long-term storage with legal hold check
   - **Export** - produce defensible evidence packet

3. **Set compliance rules:**
   - Statutory basis (M.G.L. citation or policy reference) - **required**
   - Retention class - auto-suggested from document type, overridable
   - Authority requirement - who must approve, derived from authority map
   - Audit level - standard (default) or enhanced (for sensitive operations)

4. **Review & activate:**
   - PuddleJumper validates the automation against governance rules before activation
   - Missing statutory basis -> blocked
   - Missing authority mapping -> blocked
   - Automation that increases dependency on PublicLogic -> blocked (anti-dependency rule)
   - Outputs that do not survive platform migration -> warning

**Builder empty state** should clearly communicate: "Pick a trigger, add actions, set compliance rules. PuddleJumper handles governance gates, naming, retention, and audit automatically." This is the product's value proposition in one sentence.

---

## Automation Data Model

Every automation stored and transmitted follows this structure:

```yaml
automation:
  id: "AUTO-[MODULE]-[SEQ]"
  name: "Human-readable name"
  description: "One-line trigger -> outcome"
  module: "VAULTPRR | VAULTCLERK | VAULTONBOARD | VAULTPERMIT | VAULTFISCAL | OPS"
  status: "active | gated | blocked | draft"

  trigger:
    type: "form | timer | state_transition | calendar | manual | drift | webhook"
    source: "Connector reference"
    condition: "Evaluation expression"
    statutory_basis: "M.G.L. reference or policy citation"

  steps:
    - type: "gate | route | name | file | notify | escalate | lock | clock | generate | archive | export"
      label: "Human-readable step name"
      description: "What this step does"
      target: "Connector + destination"
      config:
        # Step-type-specific configuration
      archieve_rules:
        naming: "Pattern (if applicable)"
        retention_class: "PERMANENT | 7_YEARS | 3_YEARS | UNTIL_SUPERSEDED"
        access_level: "PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED"
      meta: "Implementation reference note"

  compliance:
    statutory_basis: ["M.G.L. citations"]
    authority_required: "Role from authority map"
    audit_level: "standard | enhanced"
    anti_dependency_check: true

  audit:
    created_by: "Operator identity"
    created_at: "Timestamp"
    last_modified_by: "Operator identity"
    last_modified_at: "Timestamp"
    intent: "Why this automation exists"
    canonical_sha: "Commit hash of config version"
```

---

## Connector Inventory

PuddleJumper connects to what municipalities actually use. Nothing more.

| Connector | Used For | Auth |
|---|---|---|
| SharePoint Online | Document libraries, lists, pages, permissions | Graph API / App Registration |
| Power Automate | Flow deployment, monitoring, healthcheck | Power Platform API |
| Azure AD / Entra | Identity, role provisioning, access revocation | MSAL |
| CivicPlus / CivicOptimize | Public-facing form intake | Webhook / API key |
| Google Workspace | Drive (artifact storage), Gmail (notifications) | OAuth 2.0 |
| GitHub | Canonical repo sync, SHA tracking | GitHub App |
| Azure Key Vault | Tenant-scoped secrets | Managed Identity |

New connectors are added only when a specific municipal workflow requires them and an authority mapping exists for how data flows through the connector. No speculative integrations.

---

## Governance Rules (Enforced, Not Displayed)

These rules are baked into PuddleJumper's execution engine. They are not UI elements. The UI only surfaces them when they block something or need operator attention.

1. **No automation runs without a chartered workspace.** The four prerequisites (authority, accountability, boundary, continuity) must be confirmed before any automation in that workspace can execute.

2. **Every automation must have a statutory basis.** The `statutory_basis` field is required. If an operator cannot cite the law or policy that authorizes this automation, it cannot be activated.

3. **ARCHIEVE rules apply to all document outputs.** Every document created, moved, or archived by an automation is named per convention, filed per routing rules, and retention-clocked per schedule. This is automatic - the operator does not configure it per-automation unless overriding defaults.

4. **Gates are hard stops.** When a gate step evaluates to false, execution stops. It does not skip. It does not warn and continue. It stops and logs why.

5. **Anti-dependency rule.** No automation can reduce the town's ability to operate without PublicLogic. If an automation creates a dependency that does not survive PublicLogic's exit, it is flagged at build time and blocked at activation.

6. **All outputs must survive platform migration.** Automations that produce vendor-locked artifacts (e.g., Power Automate-only formats without portable equivalents) generate a warning at build time.

7. **Operator-initiated actions require intent statements.** Any manual trigger requires the operator to state why they are running this automation. This is recorded in the audit trail.

8. **Emergency bypass exists but is governed.** An operator can override a gate with documented justification. The override is logged, the justification is sealed, and a 72-hour post-action review is automatically scheduled.

9. **Drift detection runs daily.** Unauthorized modifications to deployed automations or environments trigger alerts with recommended revert actions.

10. **Diagnostic instruments use equal-weight binary structural tests** unless differential weighting is empirically derived and defensible. Assertion-based weighting is a prohibited pattern.

---

## UI Principles

1. **The compliance layer is the material, not decoration.** Statutory citations, authority requirements, and audit status appear on every card, every step, every detail view. They are not in a separate "compliance tab." Government is what this software is made of.

2. **Confusion only when needed.** The UI is calm by default. Confirmations, warnings, gates, and blocking messages only appear when the backend needs operator attention. No preemptive warnings. No "are you sure?" on routine actions.

3. **No hardcoded context.** Tenant names, operator names, role levels, and available automations all resolve from the backend. The UI renders what it receives. If a new tenant is added, PuddleJumper shows it without code changes.

4. **Search is the primary navigation.** The library may grow to dozens or hundreds of automations across multiple modules. Search must filter across names, descriptions, tags, and statute numbers instantly.

5. **Detail sheets, not page transitions.** Tapping a card opens a bottom-sheet overlay. The library stays underneath. Back is closing the sheet, not browser navigation.

6. **The step chain is the truth.** The detail view's step-by-step breakdown is the canonical representation of what the automation does. It must match the actual execution order. If the steps shown do not match what runs, the product is broken.

7. **Activity is a receipt, not a control surface.** The activity feed shows what happened. It does not offer actions. If something needs attention, it surfaces as a status badge on the automation card in the library.

8. **Builder is structured, not visual.** No canvas. No drag-and-drop flow diagrams. A structured form that produces a valid automation definition. The governance validation happens at build time, not after deployment.

9. **Transfer requirement.** Every automation must be describable in plain English by a non-technical town administrator. If the automation's card description cannot be understood by a Select Board member, rewrite it.

---

## Technical Stack (Reference)

- **Frontend:** Single-page app, tab-based navigation, bottom-sheet detail panels
- **Backend:** Node.js API resolving identity, permissions, tenant scope, and automation library
- **Auth:** Azure AD / Entra via MSAL
- **Data:** Automation definitions stored as YAML in canonical GitHub repo, rendered from API
- **Execution:** Power Automate flows for M365 operations, Azure Functions for orchestration
- **Audit:** Append-only log with SNAP sealing, stored in tenant-scoped SharePoint library
- **Secrets:** Azure Key Vault, tenant-scoped namespaces

---

## What Success Looks Like

1. An operator opens PuddleJumper, searches "PRR," finds the intake automation, taps it, reads every step including the M.G.L. citation and timer threshold, and taps "Run Now" - all in under 30 seconds.

2. A new town administrator inherits PuddleJumper and can understand what every automation does by reading the cards - without training, documentation, or a phone call to PublicLogic.

3. An auditor opens the activity feed and can reconstruct the complete chain of custody for any record by following the automation's execution log.

4. A Select Board member asks "what does this system do?" and the operator shows them the Automations tab. Every card is a sentence they can read. Every tag is a law they can verify.

5. PublicLogic exits the engagement. The town continues operating every automation without modification, because nothing in PuddleJumper depends on PublicLogic's continued presence.
