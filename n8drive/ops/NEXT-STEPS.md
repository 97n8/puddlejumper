# PuddleJumper Next Steps

## Completion baseline (Feb 2026)

- `main` is green with Node 20 and deterministic bootstrap flow.
- Bootstrap/auth stabilization is merged.
- Rehydration replacements are merged: #49, #50, #51, #52.
- Phase E minimal observability/playbook slice is merged: #54.
- Staging SQLite startup hardening is merged: #55.
- Tracking issues are closed: #48, #53, #20.

## Merge gate policy

- **Backend-only changes** (`n8drive/**`, backend tests/docs): GitHub CI must pass.
- **UI/site surface changes** (`publiclogic-os-ui/**` or `publiclogic-site/**`): GitHub CI + relevant Vercel status must pass.

## Current focus

- Keep CI and staging healthy under the same Node 20/runtime assumptions.
- Keep `.pj-test-logs/` local-only diagnostics.
- Open new work as small single-purpose PRs from current `main`.

## Operator notes

- Use Node 20 (`nvm use 20`) before ad-hoc test runs.
- If native module mismatch occurs, rerun `bash scripts/bootstrap.sh`.
- Keep `.pj-test-logs/` local-only for diagnostics.

## Closure checklist (completed)

- [x] Open PR A from `rehydrate/phase-e-minimal-observability` with observability/playbook-safe slice only.
- [x] Open PR B from `stabilize/fly-staging-sqlite-cantopen` with deterministic staging DB path and startup writability checks.
- [x] Run strict local gate on each branch:
  - `bash scripts/bootstrap.sh`
  - `source ~/.nvm/nvm.sh && nvm use 20 && cd n8drive/apps/puddlejumper && pnpm test -- --reporter=verbose`
- [x] Ensure GitHub CI is green for both PRs before merge.
- [x] Verify staging deploy health and absence of SQLite CANTOPEN loops after PR B.
- [x] Close tracking issues #53 and #20 with merge and verification links.
- [x] Close issue #48 with final replacement map and closure evidence.
