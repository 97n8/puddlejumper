# PublicLogic Platform — Developer Map

> Developer and agent-facing map for safely extending the platform.
>
> Source of truth: `FULL_MAP.md`. Use this file as the practical build guide.

---

## 1. Core architecture

PublicLogic is split across three repositories:

| Repo | Primary job | Rule |
|---|---|---|
| `97n8/LogicOS` | Operator frontend | Build user-facing workspace panels here. |
| `97n8/puddlejumper` | Governed runtime/backend | Build privileged execution, connector dispatch, token handling, approval logic, and runtime governance here. |
| `97n8/logiccommons` | Operations app / town surfaces / shared primitives | Maintain existing ops and town workflows; treat direct provider access as transitional unless explicitly approved. |

The canonical boundary is:

```text
Browser surfaces request work.
PuddleJumper governs execution.
VAULT authorizes policy/release.
ARCHIEVE preserves evidence/audit.
```

---

## 2. Product name ladder for developers

| Name | Build meaning |
|---|---|
| **LogicOS** | Browser SPA. Routes, panels, dashboards, CaseSpace UI, intake UI, operator workflows. |
| **PuddleJumper** | API/runtime. Auth/session, provider token custody, connector dispatch, governed execution pipeline. |
| **VAULT** | Policy authority, manifest registry, release gate, authorization checks. |
| **ARCHIEVE** | Immutable audit/evidence lane. Do not treat it as a casual log. |
| **CaseSpace** | Work container tying people, files, intake, tasks, approvals, records, and AI context together. |
| **FormKey** | Stable identity key for forms/processes/records/actions. Use it to preserve continuity across surfaces. |
| **Puddles / governed AI** | AI assistant surfaces. They may draft, summarize, classify, search, or propose actions, but they must not bypass governance. |

---

## 3. Main flow

Every governed action should follow this runtime pattern:

```text
UI / Intake
  → pjApi
  → POST /evaluate
  → plan + hash + injection scan
  → VAULT manifest registration
  → approval chain, if required
  → VAULT authorize-release
  → CAS-locked dispatch
  → connector execution
  → ARCHIEVE audit event
```

Do not create a shortcut around this flow for anything that changes external state, touches records, sends messages, modifies files, grants permissions, files forms, or moves a municipal process forward.

---

## 4. LogicOS build map

Use LogicOS for:

- Operator home/workspace
- CaseSpace views
- Intake and launch panels
- Status dashboards
- Approval views
- Record/evidence views
- AI assistant panels
- Builder/configuration panels
- Mobile-friendly staff surfaces

Do not use LogicOS for:

- Long-lived provider tokens
- Direct GitHub/Microsoft/Google/Slack privileged calls
- Governance decisions
- Final authorization
- Connector dispatch
- Permanent audit authority

Important chokepoint:

```text
src/services/pjApi.ts
```

All privileged frontend requests should go through the PJ API service layer, not ad hoc fetch calls spread across features.

---

## 5. PuddleJumper build map

Use PuddleJumper for:

- Auth/session handling
- OAuth broker flows
- Provider token storage
- Connector dispatch
- Approval chains
- Idempotency
- Rate limiting
- Runtime governance
- Policy provider integration
- PRR intake backend
- Controlled provider proxy routes

Core runtime idea:

```text
Evaluate → Register → Approve → Authorize → Dispatch → ARCHIEVE
```

Primary concepts to preserve:

- Default deny
- Deterministic plan hashing
- Prompt-injection scanning before execution
- Manifest preflight
- Multi-step approval chains where required
- Drift detection / TTL / compare-and-swap locks
- Idempotent dispatch
- Immutable audit after action

---

## 6. VAULT build map

Use VAULT for:

- Policy authority
- Manifest registry
- Authorization checks
- Release gates
- FormKey-indexed process packages
- Audit ledger authority
- Compliance metadata

Do not treat VAULT as just another database. It is the authority layer.

Where possible, new governed actions should register intent/manifest data with VAULT before dispatch and write final evidence/audit after dispatch.

---

## 7. LogicCommons build map

LogicCommons currently includes three surfaces:

1. Repository workspace
2. Operations portal
3. Phillipston governed town environment / PRR

LogicCommons has existing direct MSAL / Microsoft Graph / SharePoint behavior and a GitHub PAT workspace pattern.

Treat these as **legacy or transitional exceptions**, not the model for new governed runtime work.

New work should ask:

```text
Is this just an existing ops/town UI surface?
  → LogicCommons may be acceptable.

Does this create, alter, send, approve, file, preserve, or dispatch anything governed?
  → Route through PuddleJumper / VAULT.
```

---

## 8. Data and token custody

Hard rule:

```text
No provider tokens in the LogicOS browser.
```

Expected pattern:

- Browser holds only the app/session state it needs.
- PuddleJumper holds provider tokens server-side.
- Browser calls PJ.
- PJ injects stored connector credentials server-side.
- PJ writes audit/evidence through the governed path.

Known exception:

- LogicCommons has direct MSAL/Graph and GitHub PAT behavior. Do not expand this pattern without explicit architectural approval.

---

## 9. Agent instructions

When using AI/Codex/Claude/GitHub agents on this platform, tell them:

1. Read `FULL_MAP.md` first.
2. Read `BUILD_RULES.md` before changing code.
3. Do not add direct provider calls from LogicOS.
4. Do not store provider tokens in browser storage.
5. Do not bypass PuddleJumper for governed actions.
6. Do not bypass VAULT authorization when policy/release authority is required.
7. Do not add a new named product/module unless it fits the name ladder.
8. Prefer improving one existing surface over inventing another surface.
9. Preserve FormKey / CaseSpace continuity.
10. Add tests or at least a verification note for any boundary-sensitive change.

---

## 10. Build decision tree

```text
Need a new user screen?
  → LogicOS, unless it is an existing LogicCommons town/ops surface.

Need to call GitHub, Microsoft, Google, Slack, webhook, SharePoint, or another provider?
  → PuddleJumper connector/proxy.

Need to decide whether an action is allowed?
  → VAULT / policy provider.

Need to execute an external action?
  → PuddleJumper dispatch after governance.

Need to preserve the record?
  → ARCHIEVE / audit lane.

Need to organize a matter or process?
  → CaseSpace + FormKey.

Need AI assistance?
  → Governed AI surface inside the CaseSpace/runtime boundary.
```

---

## 11. What good changes look like

A good change usually does one of these:

- Makes a user surface simpler.
- Moves direct execution into PuddleJumper.
- Strengthens the governance pipeline.
- Adds a controlled connector.
- Improves CaseSpace continuity.
- Improves FormKey linkage.
- Makes audit/evidence more reliable.
- Removes a duplicate service path.
- Converts a legacy direct-provider call into a governed runtime call.

A risky change usually does one of these:

- Adds browser-held provider tokens.
- Adds a second way to call the same provider.
- Bypasses `pjApi`.
- Dispatches external actions without evaluation/authorization.
- Treats audit as optional.
- Adds a new named module without clarifying where it sits.
- Splits records/files/actions across unlinked surfaces.

---

## 12. Developer summary

Build the system as a governed work layer, not a collection of apps.

The job of the frontend is to make work understandable.
The job of PuddleJumper is to make execution controlled.
The job of VAULT is to make authority explicit.
The job of ARCHIEVE is to make the record durable.
