# Approval Gate & Connector Dispatch — Runbook

## Overview

The approval gate intercepts governed decisions from `POST /api/pj/execute` and
requires human sign-off before dispatch to external connectors (GitHub, SharePoint, etc.).

**Flow:**

```
Client POST /api/pj/execute (mode: execute, governed)
  → Governance engine evaluates → approved
  → ApprovalStore.create() → row with status "pending"
  → Response: 202 Accepted { approvalId, approvalRequired: true }

Admin reviews
  → POST /api/approvals/:id/decide { status: "approved" }
  → Row transitions: pending → approved

Admin dispatches
  → POST /api/approvals/:id/dispatch
  → consumeForDispatch() CAS: approved → dispatching
  → dispatchPlan() executes steps via connector dispatchers
  → Row transitions: dispatching → dispatched | dispatch_failed
```

**Statuses:** `pending → approved → dispatching → dispatched`
(or `→ rejected`, `→ dispatch_failed`, `→ expired`)

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/api/approvals` | Authenticated (admin sees all, others see own) | List approvals. Query: `?status=pending&limit=50&offset=0` |
| `GET`  | `/api/approvals/:id` | Authenticated | Get single approval with parsed plan/audit/decision |
| `POST` | `/api/approvals/:id/decide` | Admin only | `{ status: "approved"\|"rejected", note?: string }` |
| `POST` | `/api/approvals/:id/dispatch` | Admin only | `{ dryRun?: boolean }` — executes the approved plan |
| `GET`  | `/api/approvals/count/pending` | Authenticated | `{ pendingCount: number }` |

---

## Smoke Tests (curl)

### Prerequisites

```bash
export BASE=https://publiclogic-puddlejumper.fly.dev
export TOKEN="<your-jwt>"
export CSRF="X-PuddleJumper-Request: true"
```

### 1. Verify health

```bash
curl -s "$BASE/health" | python3 -m json.tool | head -10
# Expect: { "status": "ok" }
```

### 2. Check pending count

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/approvals/count/pending" | python3 -m json.tool
# Expect: { "success": true, "data": { "pendingCount": 0 } }
```

### 3. List approvals

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/approvals?status=pending&limit=10" | python3 -m json.tool
```

### 4. Approve a pending approval

```bash
APPROVAL_ID="<id-from-202-response>"
curl -i -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/approvals/$APPROVAL_ID/decide" \
  -d '{ "status": "approved", "note": "Reviewed and approved — smoke test" }'
# Expect: 200 { success: true, data: { approval_status: "approved" } }
```

### 5. Dispatch an approved plan

```bash
curl -i -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/approvals/$APPROVAL_ID/dispatch" \
  -d '{ "dryRun": true }'
# Expect: 200 { success: true, data: { dispatchResult: { ... } } }
```

### 6. Verify dry-run bypasses gate

```bash
curl -i -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/pj/execute" \
  -d '{
    "actionId": "environment.create",
    "mode": "dry-run",
    "payload": { "name": "smoke-test-env" }
  }'
# Expect: 200 (NOT 202) — dry-run is never gated
```

---

## Debugging Checklist

When a governed action is stuck or fails:

### 1. Confirm service health

```bash
curl -s "$BASE/health" | python3 -m json.tool
```

- Check `status: "ok"`, all checks pass.
- If `status: "degraded"` or `"error"` — address infrastructure first.

### 2. Tail logs for the approval

```bash
fly logs --app publiclogic-puddlejumper | grep -E '<approvalId>|<requestId>'
```

Look for structured JSON entries with these scopes:
- `pj.execute.approval_created` — gate fired, approval persisted
- `pj.execute.approval_create_failed` — gate error (check for duplicate requestId)
- `approval.decided` — admin approved/rejected
- `approval.dispatch.started` / `approval.dispatch.completed` / `approval.dispatch.failed`

### 3. Query the approval record

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/approvals/<approvalId>" | python3 -m json.tool
```

Check:
- `approval_status` — where in the lifecycle is it?
- `approver_id` — who approved? (null if still pending)
- `dispatched_at` — was dispatch attempted?
- `dispatch_result_json` — what happened during dispatch?
- `expires_at` — has it expired?

### 4. Status-specific investigation

| Status | Investigation |
|--------|---------------|
| `pending` | No admin has reviewed yet. Check `expires_at` — will auto-expire after 48h. |
| `approved` | Ready for dispatch. Admin should POST `/dispatch`. If dispatch keeps failing, check connector credentials. |
| `dispatching` | In progress. If stuck, crash may have interrupted mid-dispatch. Check logs for errors. |
| `dispatched` | Complete. Check `dispatch_result_json` for connector responses (PR URLs, etc.). |
| `dispatch_failed` | Connector error. Check `dispatch_result_json` for error details. Verify connector tokens and external API status. |
| `rejected` | Admin rejected. Check `approval_note` for reason. |
| `expired` | TTL elapsed without decision. Re-submit the action if still needed. |

### 5. CAS / double-dispatch issues

If `consumeForDispatch()` returned null:
- Another process already consumed it (expected in concurrent scenarios)
- Check logs for `consume_for_dispatch.conflict` events
- The approval is already in `dispatching` state — only one consumer wins

### 6. Connector health

If dispatch fails at the connector level:
- **GitHub:** Check `GITHUB_DISPATCH_TOKEN` env var is set and the PAT has `repo` scope
- **GitHub API:** `curl -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/rate_limit`
- Check for 401/403 errors in dispatch result JSON

---

## Data & Persistence

| Store | Path | Purpose |
|-------|------|---------|
| `approvals.db` | `data/approvals.db` | Approval lifecycle records |
| `prr.db` | `data/prr.db` | PRR intake store |
| `connectors.db` | `data/connectors.db` | Connector state |
| `oauth_state.db` | `data/oauth_state.db` | OAuth CSRF tokens |

- All DBs use SQLite WAL mode for concurrent read performance
- `approvals.db` auto-prunes expired records every 5 minutes
- Default TTL for pending approvals: **48 hours**
- Ensure `data/` is on a persistent volume in Fly.io

---

## Security Considerations

- **RBAC:** Only `admin` role can approve/reject/dispatch. Non-admins can only view their own approvals.
- **CSRF:** All API routes require `X-PuddleJumper-Request: true` header.
- **Plan hash:** Approvals store the `planHash` from the engine audit record — future enhancement can validate the plan hasn't changed between approval and dispatch.
- **Idempotency:** Duplicate `requestId` on execute returns the existing approval (no duplicates created).
- **Atomic CAS:** `consumeForDispatch()` uses a single `UPDATE ... WHERE approval_status = 'approved'` to prevent double-dispatch.
- **Audit trail:** All lifecycle transitions are timestamped (`created_at`, `updated_at`, `dispatched_at`). Full decision result and audit record are persisted as JSON.

---

## Scaling Notes

- SQLite is single-writer — adequate for current throughput but watch write contention if scaling to many concurrent dispatchers.
- If dispatch throughput exceeds ~100 writes/sec or you need multi-region writes, consider migrating approval store to Postgres.
- `consumeForDispatch()` CAS remains correct under SQLite's serialized write model.

---

## Metrics & Observability

### Prometheus endpoint

```
GET /metrics          (text/plain; Prometheus exposition format)
Authorization: Bearer <METRICS_TOKEN>   (required if METRICS_TOKEN env is set)
```

### Key metrics

| Name | Type | Description |
|------|------|-------------|
| `approvals_created_total` | counter | Approvals created via governance gate |
| `approvals_approved_total` | counter | Approvals decided as approved |
| `approvals_rejected_total` | counter | Approvals decided as rejected |
| `approvals_expired_total` | counter | Approvals that expired before decision |
| `approval_pending_gauge` | gauge | Current pending approvals |
| `approval_time_seconds` | histogram | Seconds from creation to decision |
| `dispatch_success_total` | counter | Successful dispatches to connectors |
| `dispatch_failure_total` | counter | Failed dispatches to connectors |
| `dispatch_latency_seconds` | histogram | Duration of dispatch plan execution |
| `consume_for_dispatch_success_total` | counter | Successful CAS lock acquisitions |
| `consume_for_dispatch_conflict_total` | counter | CAS conflicts (double-dispatch prevented) |

### Quick checks

```bash
# 1. Verify metrics endpoint returns Prometheus format
curl -s $BASE/metrics | head -20

# 2. Grep for approval counters
curl -s $BASE/metrics | grep -E "approvals_(created|approved|rejected)_total"

# 3. Check pending gauge
curl -s $BASE/metrics | grep approval_pending_gauge

# 4. After exercising a workflow, verify counters incremented
curl -s $BASE/metrics | grep -E "dispatch_(success|failure)_total"
```

### Alerts

See [`ops/alerts/approval-alerts.yml`](../alerts/approval-alerts.yml) for Prometheus alert rules:

| Alert | Condition | Severity |
|-------|-----------|----------|
| `ApprovalsBacklogHigh` | pending > 10 for 10m | page |
| `DispatchFailuresSpike` | >5 failures in 5m | page |
| `ConsumeForDispatchConflictsSpike` | >5 CAS conflicts in 5m | warn |
| `ApprovalTimeTooHigh` | p95 decision time > 10m | page |
| `DispatchLatencyHigh` | p95 dispatch > 60s | warn |
| `NoApprovalsProcessed` | created but none decided in 24h | warn |

### Label cardinality rules

- **Do NOT** add `user_id`, `actor`, or other high-cardinality labels to counters/histograms.
- Safe labels: `action_type` (URN), `result` (success|failure), `status` (approved|rejected).
- Per-user telemetry belongs in structured logs, not Prometheus metrics.
