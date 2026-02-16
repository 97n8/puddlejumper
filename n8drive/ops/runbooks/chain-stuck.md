# Chain Step Stuck > 24h — Runbook

## Alert: ChainStepStuck24h

**Severity:** warn  
**Condition:** `approval_chain_step_pending_gauge > 0` and no chain step decisions in 24h.

## What it means

One or more approval chain steps are in `active` status (awaiting a decision) but no step has been decided in the last 24 hours. This typically means:

1. **No approver available** — the step requires a role (e.g. `legal`, `department_head`) and no user with that role has acted.
2. **Approver unaware** — notifications may not have reached the assigned role.
3. **Misconfigured template** — the step's `requiredRole` doesn't match any active user's role.

## Investigation steps

1. **Identify stuck steps:**
   ```sql
   SELECT acs.id, acs.approval_id, acs.required_role, acs.label, acs.created_at
   FROM approval_chain_steps acs
   WHERE acs.status = 'active'
   ORDER BY acs.created_at ASC;
   ```

2. **Check which approvals are affected:**
   ```sql
   SELECT a.id, a.action_intent, a.operator_id, a.workspace_id, a.created_at
   FROM approvals a
   JOIN approval_chain_steps acs ON acs.approval_id = a.id
   WHERE acs.status = 'active'
   AND a.status = 'pending';
   ```

3. **Verify role availability** — confirm that users with the required role exist in the workspace.

4. **Check admin UI** — navigate to `/pj/admin#approvals` and filter for pending approvals to see chain progress.

## Resolution

- **If approver is available:** contact them directly and point to the pending step in the admin UI.
- **If role is misconfigured:** update the chain template to use the correct role, then reject the stuck approval and re-submit.
- **If approver is unavailable:** an admin (superrole) can decide the step via `POST /api/approvals/:id/decide`.

## Silence criteria

This alert can be silenced during planned maintenance windows or when the system has no active municipal workflows.
