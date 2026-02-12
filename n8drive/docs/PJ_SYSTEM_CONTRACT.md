# PuddleJumper System Contract

Status: Enforced  
Scope: All PJ UI and `/api/pj/*` backend routes  
Non-negotiable: Yes

You are building and modifying **PuddleJumper (PJ)**, a governance-bound operator interface inside PublicLogic infrastructure.

PJ is not a demo UI.  
PJ is not a marketing shell.  
PJ is an authenticated, manifest-gated, backend-authoritative control surface.

All future changes MUST comply with the following rules.

## 1) Authority Model

PJ is:
- Identity-bound (`/api/identity`)
- Capability-gated (`/api/capabilities/manifest`)
- Backend-authoritative (`/api/pj/*`, `/api/access/*`)
- Audit-tracked
- Tenant-scoped
- Fail-closed

PJ MUST NEVER:
- Render demo or placeholder data in production paths.
- Simulate backend behavior.
- Trust client-provided permissions.
- Use localStorage as authoritative state.
- Execute actions without server confirmation.

All state comes from the backend.

## 2) Security Requirements (Non-Negotiable)

### DOM Rules
- Never use `innerHTML` for dynamic content.
- Render using `createElement`, `textContent`, `appendChild`.
- No dynamic HTML injection.

### CSP Rules
- No `unsafe-inline`.
- No third-party script hosts.
- Hash or nonce-based CSP only.
- No widening of `connect-src` without explicit justification.

### PostMessage Rules
- Only trust origins defined by server.
- Never trust sender-provided origin allowlists.
- Require message source to be `window.parent` when embedded.

## 3) Capability Gating

Every section, button, or action MUST:
- Be hidden if capability flag is false.
- Fail closed if manifest cannot be loaded.
- Never assume capability from role string alone.

UI is driven entirely by the manifest.

## 4) Access Governance

Access requests:
- Must call `POST /api/access/request`.
- Must be tenant-scoped.
- Must write to ARCHIEVE via atomic transaction.
- Must enqueue notification (`info@publiclogic.org`).
- Must generate audit entry.
- Must include correlation ID.

No client-only invites.  
No direct identity grants from PJ UI.

All grants flow through governance lifecycle:
`requested -> approved -> provisioned -> closed`.

## 5) Error Handling

All failures must:
- Surface correlation ID if available.
- Fail visibly.
- Not silently degrade to demo content.
- Not mask authorization errors.

PJ never pretends success.

## 6) No Demo Mode in Production

Demo behavior is only allowed if:
- Explicit `DEMO_MODE=true`
- Separate build flag
- Never active in tenant runtime

Production PJ must always be live-bound.

## 7) Architectural Principle

PJ is:
- A human-first operational control surface
- Bound by governance
- Constrained by capability
- Audited by design
- Secure by default

Not a playground.  
Not a mock.  
Not a cosmetic layer.

## 8) Implementation Mandate

When modifying PJ:
- Maintain strict typing on API contracts.
- Add tests for new routes.
- Preserve correlation IDs.
- Maintain tenant containment.
- Preserve atomic write semantics.

Any change that weakens governance, capability gating, or security posture is invalid.

## Enforcement

The following CI checks enforce this contract:
- No `innerHTML` usage in PJ UI.
- No `unsafe-inline` in CSP.
- No demo fallbacks in production build.
- All PJ actions must route through `/api/pj/execute`.

Pull requests violating these conditions will fail CI.
