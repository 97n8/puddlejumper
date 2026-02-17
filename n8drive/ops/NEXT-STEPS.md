# PuddleJumper Next Steps

## Current baseline (Feb 2026)

- `main` is green with Node 20 and deterministic bootstrap flow.
- Bootstrap/auth stabilization has landed.
- Rehydration is in progress via focused PRs from fresh branches.

## Active rehydration tracks

1. **RBAC/API safety**
   - Chain template admin-only access + tests
   - Targeted step decision validation (`stepId`) + negative tests

2. **Async policy provider adoption**
   - Promise-based `PolicyProvider` contract
   - Governance and engine callsites updated to `await`

3. **OS/UI stability**
   - Playwright smoke locator hardening
   - Playbook sync script shell-safety hardening (`nullglob`)

## Merge gate policy

- **Backend-only changes** (`n8drive/**`, backend tests/docs): GitHub CI must pass.
- **UI/site surface changes** (`publiclogic-os-ui/**` or `publiclogic-site/**`): GitHub CI + relevant Vercel status must pass.

## Immediate execution order

1. Merge rehydrated RBAC/template access PR.
2. Merge rehydrated `stepId` hardening PR.
3. Merge async `PolicyProvider` contract PR.
4. Merge OS/UI smoke + sync hardening PR.
5. Close stale Copilot-era PRs with links to replacement PRs.

## Optional follow-up bundle

If needed, split observability/playbook backlog into separate PRs:

- backend metrics + alerts
- playbook content sync
- workflow/CI automation

Each should be independently mergeable and keep lockfile churn out of scope.

## Operator notes

- Use Node 20 (`nvm use 20`) before ad-hoc test runs.
- If native module mismatch occurs, rerun `bash scripts/bootstrap.sh`.
- Keep `.pj-test-logs/` local-only for diagnostics.
