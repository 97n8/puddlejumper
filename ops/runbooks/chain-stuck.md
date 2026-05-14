# Chain Step Stuck > 24h Runbook

## Alert

- Name: `ChainStepStuck24h`
- Condition: `approval_chain_step_pending_gauge > 0` and no decisions in 24h
- Severity: `warn`

## Meaning

A chain step is active and waiting, but no step decisions were recorded in the last 24h.

Likely causes:
- Required approver role has no active user.
- Approver was not notified.
- Chain template role mapping is incorrect.

## Investigate

1. Find active steps:

```sql
SELECT id, approval_id, required_role, label, created_at
FROM approval_chain_steps
WHERE status = 'active'
ORDER BY created_at ASC;
```

2. Find impacted approvals:

```sql
SELECT a.id, a.action_intent, a.operator_id, a.workspace_id, a.created_at
FROM approvals a
JOIN approval_chain_steps s ON s.approval_id = a.id
WHERE s.status = 'active' AND a.status = 'pending';
```

3. Confirm users exist for each `required_role`.
4. Check `/pj/admin#approvals` for stalled approvals and chain state.

## Resolve

- If approver exists: notify them and request decision.
- If template role is wrong: fix template, reject stuck approval, resubmit.
- If approver unavailable: admin can decide via `POST /api/approvals/:id/decide`.

## Silence guidance

Silence only during planned maintenance windows or when no active workflows are expected.
