# PuddleJumper Next Steps

## V1 completion baseline (Feb 2026)

V1.0.0 shipped on 2026-02-16. The 90-day roadmap from ARCHITECTURE-NORTH-STAR.md
is complete:

- Multi-step approval chains with parallel support: **shipped**
- Chain templates and progression logic: **shipped**
- Control Plane admin UI (queue, templates, members, dashboard): **shipped**
- PolicyProvider interface with LocalPolicyProvider: **shipped**
- Multi-tenant workspaces with tier enforcement: **shipped**
- OAuth (GitHub, Google, Microsoft): **shipped**
- Prometheus metrics, Grafana dashboard, alert rules: **shipped**
- 507+ tests across core, logic-commons, puddlejumper: **passing**

Prior stabilization work is also merged:
bootstrap/auth (#49–#52), observability (#54), SQLite hardening (#55),
tracking issues #48, #53, #20 closed.

## Merge gate policy

- **Backend-only changes** (`n8drive/**`, backend tests/docs): GitHub CI must pass.
- **UI/site surface changes** (`publiclogic-os-ui/**` or `publiclogic-site/**`): GitHub CI + relevant Vercel status must pass.

## Operator notes

- Use Node 20 (`nvm use 20`) before ad-hoc test runs.
- If native module mismatch occurs, rerun `bash scripts/bootstrap.sh`.
- Keep `.pj-test-logs/` local-only for diagnostics.
- Open new work as small single-purpose PRs from current `main`.

---

## Next phase: V1.1 — Operational Hardening & Integration

With V1 governance features complete, the next phase focuses on production
hardening, integration gaps, and operator-facing improvements. These items come
directly from the V1 known-limitations list and stubbed code paths.

### Priority 1 — Audit log viewer (backend + UI)

**Why now:** Audit events are written to SQLite (`writeAuditEvent` in
`LocalPolicyProvider`) but there is no UI or API to view them. Municipality
admins cannot see what happened without database access.

**Scope:**
- `GET /api/audit` — paginated audit event list, filterable by workspace,
  action type, date range, and actor.
- Admin UI tab or page rendering the audit trail with search and time filters.
- Read-only — no mutation through the UI (preserves PJ/VAULT boundary).

**Tests:** Query pagination, workspace isolation, date-range filtering.

### Priority 2 — Webhook event idempotency

**Why now:** The frontend webhook handler (`web/src/app/api/webhook/route.ts`)
verifies HMAC signatures but has an explicit TODO for idempotency and business
logic. Duplicate deliveries from upstream systems will cause repeated
processing.

**Scope:**
- Store processed event IDs (SQLite or durable Set with TTL) so redelivered
  webhooks return `200` without re-processing.
- Route received events to domain handlers (e.g., access-notification,
  approval-status-change).

**Tests:** Duplicate delivery returns 200 without side effects, unknown event
types are logged and acked, TTL expiry.

### Priority 3 — Notification integrations (Slack / Teams)

**Why now:** `SlackDispatcher` exists as a dispatcher stub. Approval decisions
currently have no push notification path — admins must poll the UI.

**Scope:**
- Slack incoming-webhook dispatcher: send approval-pending and
  approval-decided notifications to a configured channel.
- Microsoft Teams webhook dispatcher (same pattern).
- Configuration via workspace settings (webhook URL + channel).

**Tests:** Dispatcher formatting, retry on 5xx, channel routing.

### Priority 4 — Approval export (CSV / JSON)

**Why now:** Compliance teams need offline records. The approval store has all
the data but no export surface.

**Scope:**
- `GET /api/approvals/export?format=csv|json` — filtered by workspace and date
  range.
- Include chain step detail and dispatch evidence in export.
- Streamed response for large result sets.

**Tests:** CSV column correctness, JSON schema validation, workspace isolation.

### Priority 5 — Email delivery for invitations

**Why now:** Workspace invitations show a copy-link UI. Actual email delivery
is not implemented. This limits onboarding for non-technical admins.

**Scope:**
- Integrate a transactional email provider (SendGrid or Postmark).
- Send invitation emails with accept-link when a workspace owner invites a
  member.
- Respect existing token-based acceptance flow — email just delivers the link.

**Tests:** Email send called with correct recipient and token URL, graceful
fallback when provider is unavailable.

---

## Deferred (revisit triggers documented)

These items are intentionally deferred per ARCHITECTURE-NORTH-STAR.md.
Triggers are listed so the decision to defer can be revisited with evidence.

| Item | Revisit when |
|------|-------------|
| Stripe billing integration | First paying customer or manual upgrades exceed 10/month |
| Multi-workspace per user | User feedback requests it; current single-workspace sufficient |
| Workspace ownership transfer | Support request or compliance requirement |
| VAULT service (remote PolicyProvider) | Municipal customer needs compliance-grade audit separation |
| Connector marketplace | 5+ active dispatchers |
| SQLite → Postgres migration | Sustained >100 writes/sec or multi-region requirement |
| Rule engine extraction | 3+ municipalities with >30% rule divergence |

## PolicyProvider stubs to revisit

The `LocalPolicyProvider` has three pass-through stubs that will need real
implementations when VAULT ships or when PJ handles manifest-based deployments:

| Method | Current behavior | Needed when |
|--------|-----------------|-------------|
| `registerManifest()` | Returns `{ accepted: true }` | Manifest-based deployment tracking |
| `authorizeRelease()` | Returns `{ authorized: true }` | Post-approval release gates (freeze windows, budget caps) |
| `classifyDrift()` | Returns `{ severity: "none" }` | Drift detection between deployed artifacts and approved manifests |

No code changes needed now — these stubs are correct for V1. Document them here
so they are not forgotten when the corresponding features are prioritized.
