# Pull Request Cleanup Guide

## Summary

8 open PRs reviewed. Here's the state of things and what to do.

### Already merged (no action needed)

| PR | Title | Status |
|----|-------|--------|
| #27 | Fix contract check, add missing CI tests, harden Docker/Actions | ✅ Merged |
| #39 | Fix @publiclogic/logic-commons imports; admin UI tabs | ✅ Merged |
| #41 | System cleanup: workflow permissions, smoke-test fix, Logicville OS | ✅ Merged |

### Close — empty or superseded

| PR | Title | Why |
|----|-------|-----|
| #43 | [WIP] Perform full systems review | Empty diff (0 files changed). Just a placeholder. Close it. |
| #44 | [WIP] Review and clean up pull requests | **This PR** — close after merging or use it to land the fixes below. |
| #36 | Close #36: no-op revert | Already closed. No action. |
| #37 | Strip lockfile churn from PRs #32 and #34 | Already closed (superseded by #33). No action. |

### Close — fully superseded by later PRs

| PR | Title | Superseded by |
|----|-------|---------------|
| #40 | Logicville playbooks, governance card, observability, CI safety nets | #42 (contains all the same OS UI + playbook + CI work). Backend observability metrics from #40 can be re-applied later as a standalone PR if needed. |

### Merge in order (backend — PuddleJumper engine)

These touch `n8drive/` and must be merged sequentially, rebasing after each merge:

| Order | PR | Title | Files | Status |
|-------|-----|-------|-------|--------|
| 1 | #33 | Strip lockfile churn from #32 and #34 | 2 files, +234/-6 | Draft — mark ready, merge |
| 2 | #34 | Admin-only chain template endpoints | 3 files, +47/-20 | Draft — rebase on main after #33, mark ready, merge |
| 3 | #32 | Async PolicyProvider (HTTP-to-VAULT) | 5 files, +253/-60 | Draft — rebase on main after #34, mark ready, merge |
| 4 | #38 | Governance engine consumes async PolicyProvider | 9 files, +5020/-4513 | Draft — rebase on main after #32, mark ready, merge |
| 5 | #35 | Harden stepId validation + role matching docs | 2 files, +574/-13 | Draft — rebase on main after #38, mark ready, merge |

### Merge separately (frontend — OS UI)

| PR | Title | Files | Status | Notes |
|----|-------|-------|--------|-------|
| #42 | Playwright config + CI workflows for OS UI smoke tests | 18 files, +761/-26 | Open (not draft) | Has merge conflicts. Needs rebase. Has 6 review comments — **fixed in this PR (#44).** |

### Fixes applied in this PR (#44)

1. **`scripts/sync-playbooks.sh`** — Added `shopt -s nullglob` after `set -euo pipefail` so `for md in "$DIR"/*.md` loops don't fail on empty directories.
2. **`tests/e2e/tools-smoke.spec.ts`** — Fixed all Playwright locator syntax from incorrect `page.locator('a', { hasText: '...' })` to correct `page.locator('a:has-text("...")')` (5 locations).

---

## Bash commands to paste

### Step 1: Close empty/superseded PRs

```bash
gh pr close 43 --comment "Empty diff — closing as part of PR cleanup."
gh pr close 40 --comment "Superseded by #42 (OS UI + playbooks + CI). Backend observability can be re-applied standalone."
```

### Step 2: Merge this cleanup PR (#44) to land the locator + nullglob fixes

```bash
gh pr ready 44
gh pr merge 44 --squash --subject "fix: Playwright locator syntax + nullglob in sync script"
```

### Step 3: Merge backend PRs in order

```bash
# 1. Lockfile churn cleanup
gh pr ready 33
gh pr merge 33 --squash --subject "chore: strip lockfile churn from PRs #32 and #34"

# 2. Chain template admin endpoints
git fetch origin copilot/add-chain-templates-router
git checkout copilot/add-chain-templates-router
git rebase origin/main
git push origin copilot/add-chain-templates-router --force-with-lease
gh pr ready 34
gh pr merge 34 --squash --subject "feat: admin-only chain template CRUD endpoints"

# 3. Async PolicyProvider
git fetch origin copilot/expand-policy-provider-interface
git checkout copilot/expand-policy-provider-interface
git rebase origin/main
git push origin copilot/expand-policy-provider-interface --force-with-lease
gh pr ready 32
gh pr merge 32 --squash --subject "feat: make PolicyProvider async for RemotePolicyProvider"

# 4. Governance engine consumes PolicyProvider
git fetch origin copilot/update-puddlejumper-systems-map
git checkout copilot/update-puddlejumper-systems-map
git rebase origin/main
git push origin copilot/update-puddlejumper-systems-map --force-with-lease
gh pr ready 38
gh pr merge 38 --squash --subject "feat: governance engine consumes async PolicyProvider"

# 5. stepId validation hardening
git fetch origin copilot/review-progress-without-interruption
git checkout copilot/review-progress-without-interruption
git rebase origin/main
git push origin copilot/review-progress-without-interruption --force-with-lease
gh pr ready 35
gh pr merge 35 --squash --subject "fix: harden stepId validation and document role matching"
```

### Step 4: Merge OS UI PR

```bash
# Rebase #42 on main (after backend PRs are in)
git fetch origin copilot/review-pr-41-merge
git checkout copilot/review-pr-41-merge
git rebase origin/main
git push origin copilot/review-pr-41-merge --force-with-lease
gh pr merge 42 --squash --subject "feat: Playwright config, CI workflows, Logicville OS connection"
```

### Step 5: Clean up remote branches

```bash
git checkout main && git pull
git branch -D copilot/fix-role-authorization-decision copilot/add-chain-templates-router copilot/expand-policy-provider-interface copilot/update-puddlejumper-systems-map copilot/review-progress-without-interruption copilot/review-pr-41-merge copilot/review-suggestions-next-phase copilot/full-systems-review copilot/clean-up-pull-requests 2>/dev/null
```
