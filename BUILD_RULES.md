# PublicLogic Platform — Build Rules

> Canonical architectural guardrails for humans, agents, contractors, and future development.
>
> Read this before adding features, integrations, AI flows, connectors, or new surfaces.

---

# 0. Prime directive

PublicLogic is a governed work layer.

Do not optimize for “more features.”
Optimize for:

- continuity,
- authority,
- defensibility,
- auditability,
- controlled execution,
- and understandable work.

The system should hold when:

- staff changes,
- vendors change,
- AI models change,
- domains change,
- or a matter must be reconstructed years later.

---

# 1. Canonical boundary

```text
Browser surfaces request work.
PuddleJumper governs execution.
VAULT authorizes.
ARCHIEVE preserves.
```

This boundary is the spine of the platform.

Do not casually violate it.

---

# 2. Token custody rule

## Hard rule

```text
No provider tokens in LogicOS browser storage.
```

No GitHub tokens.
No Google OAuth tokens.
No Microsoft Graph tokens.
No Slack tokens.
No long-lived API secrets.

Provider credentials belong server-side inside PuddleJumper.

Expected pattern:

```text
Browser
  → PuddleJumper session
  → PJ connector proxy
  → provider
```

Known exceptions:

- Existing LogicCommons MSAL/Graph surfaces
- Existing LogicCommons GitHub PAT workspace

These are transitional exceptions, not the future-state model.

---

# 3. Governance rule

If an action can:

- change external state,
- send a message,
- create or alter a record,
- upload or delete a file,
- grant access,
- dispatch a workflow,
- file a form,
- affect compliance,
- or move a municipal process forward,

then it is a governed action.

Governed actions must pass through:

```text
Evaluate → Register → Approve → Authorize → Dispatch → ARCHIEVE
```

No hidden bypasses.
No side channels.
No “temporary shortcuts.”

---

# 4. LogicOS rules

Use LogicOS for:

- UI panels
- dashboards
- CaseSpaces
- intake
- routing surfaces
- approval surfaces
- search
- AI assistance
- visualization
- configuration
- mobile operator experiences

Do not use LogicOS for:

- privileged execution,
- token custody,
- policy authority,
- connector dispatch,
- or permanent audit authority.

Important rule:

```text
Use pjApi as the chokepoint.
```

Do not scatter direct provider fetch calls throughout the UI.

---

# 5. PuddleJumper rules

PuddleJumper is the governed runtime.

It owns:

- auth/session,
- OAuth,
- token custody,
- provider connectors,
- approval chains,
- runtime governance,
- dispatch,
- idempotency,
- and controlled execution.

All new privileged provider integrations should terminate here.

If you are unsure where something belongs:

```text
If it executes or dispatches, it probably belongs in PJ.
```

---

# 6. VAULT rules

VAULT is not “just another service.”

It is the authority layer.

Use it for:

- manifest registration,
- authorization checks,
- release gates,
- policy enforcement,
- audit authority,
- and FormKey-linked governance.

Do not bypass VAULT when:

- approval authority matters,
- release authorization matters,
- policy enforcement matters,
- or an immutable governance trail is expected.

---

# 7. ARCHIEVE rules

ARCHIEVE is the evidence lane.

Treat audit as:

- durable,
- reconstructable,
- attributable,
- and continuity-preserving.

Do not treat audit as a debug log.

The record should explain:

- who requested something,
- what was evaluated,
- what was approved,
- what executed,
- what changed,
- and what evidence exists afterward.

---

# 8. Naming rules

Do not create new named systems casually.

Before adding a new name, ask:

```text
Is this:
- a feature,
- a CaseSpace,
- a workflow,
- a panel,
- a connector,
- or a true platform layer?
```

Prefer extending:

- LogicOS,
- PuddleJumper,
- VAULT,
- ARCHIEVE,
- CaseSpaces,
- or FormKey

instead of inventing another branded object.

The architecture should become simpler over time, not more fragmented.

---

# 9. AI rules

AI is an assistant layer inside a governed environment.

AI may:

- summarize,
- classify,
- search,
- explain,
- route,
- draft,
- prepare plans,
- and recommend actions.

AI may not:

- silently dispatch governed actions,
- bypass approvals,
- bypass authorization,
- bypass audit,
- or create invisible state changes.

Every meaningful action should remain attributable and reconstructable.

---

# 10. CaseSpace rules

CaseSpaces are continuity containers.

A CaseSpace should be able to hold:

- intake,
- files,
- records,
- approvals,
- AI context,
- timelines,
- tasks,
- communications,
- and evidence.

The goal is not “more folders.”
The goal is:

```text
A process that can survive turnover and still make sense later.
```

---

# 11. FormKey rules

FormKey is the continuity identity.

Use it to tie together:

- forms,
- actions,
- files,
- approvals,
- manifests,
- records,
- automation,
- and audit.

Avoid creating disconnected identifiers for the same governed process.

---

# 12. Build philosophy

Good changes:

- simplify user understanding,
- strengthen governance,
- reduce duplicate pathways,
- improve continuity,
- improve auditability,
- improve reliability,
- or reduce hidden state.

Bad changes:

- create a second execution path,
- create another auth pattern,
- add another runtime authority,
- scatter tokens into browsers,
- bypass governance,
- or fragment the record.

---

# 13. Migration philosophy

Legacy paths may temporarily exist.

Do not expand them.

When touching legacy direct-provider flows:

```text
Prefer migration toward:
LogicOS → PuddleJumper → VAULT → ARCHIEVE
```

not away from it.

---

# 14. Agent instruction block

When using AI agents on this platform:

1. Read `FULL_MAP.md`
2. Read `DEVELOPER_MAP.md`
3. Read `BUILD_RULES.md`
4. Preserve the canonical boundary
5. Use `pjApi`
6. Keep tokens server-side
7. Route governed actions through PJ
8. Use VAULT for authority/policy
9. Preserve ARCHIEVE continuity
10. Avoid introducing new architectural names unless necessary

---

# 15. Final principle

PublicLogic is not trying to become “another app suite.”

It is trying to become:

```text
A continuity and governance layer for operational work.
```

The frontend should feel simple.
The runtime should feel controlled.
The authority should be explicit.
The record should hold.
