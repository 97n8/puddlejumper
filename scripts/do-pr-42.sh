#!/usr/bin/env bash
# ── PR #42 Helper ────────────────────────────────────────────────────────────
#
# One-shot script to commit, push, create/find PR, and attempt merge.
#
# Usage:
#   ./scripts/do-pr-42.sh          # Run the full flow
#
# Prerequisites:
#   - gh (GitHub CLI) installed and authenticated
#   - On the correct branch (copilot/review-suggestions-next-phase or similar)
#
set -euo pipefail

REPO="97n8/puddlejumper"
BRANCH="$(git branch --show-current)"
BASE="main"
TITLE="feat(os): Logicville playbooks, governance card, sync scripts, smoke test"
BODY="Summary:

- Adds canonical Logicville playbooks to publiclogic-operating-system/
- Adds \"Logicville — Governance\" card to Tools page (Agenda / Playbooks / optional PuddleJumper Admin)
- Adds playbook sync utilities (scripts/sync-playbooks.sh) with --check mode for CI
- Adds Playwright smoke test (publiclogic-os-ui/tests/e2e/tools-smoke.spec.ts)
- Adds CI workflows for playbook sync check and Playwright smoke test

Notes:
- Does not change n8drive/ (no conflict with backend PRs)"

echo "── PR Helper ──────────────────────────────────────────"
echo "Branch: $BRANCH"
echo "Base:   $BASE"
echo ""

# Step 1: Commit any uncommitted changes
echo "Step 1: Committing local changes..."
git add -A
git commit -m "$TITLE" 2>/dev/null && echo "  ✓ Committed." || echo "  ✓ Nothing to commit."

# Step 2: Push
echo "Step 2: Pushing branch..."
git push -u origin "$BRANCH"
echo "  ✓ Pushed."

# Step 3: Create or find PR
echo "Step 3: Creating or finding PR..."
EXISTING_PR=$(gh pr list --repo "$REPO" --head "$BRANCH" --state open --json number --jq '.[0].number // empty' 2>/dev/null || true)

if [[ -n "$EXISTING_PR" ]]; then
  PR_NUMBER="$EXISTING_PR"
  echo "  ✓ Found existing PR #$PR_NUMBER"
  PR_URL=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json url --jq '.url' 2>/dev/null || echo "https://github.com/$REPO/pull/$PR_NUMBER")
else
  PR_URL=$(gh pr create --repo "$REPO" \
    --title "$TITLE" \
    --body "$BODY" \
    --base "$BASE" --head "$BRANCH" 2>&1)
  PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$' || true)
  echo "  ✓ Created PR #$PR_NUMBER"
fi

echo ""
echo "PR URL: $PR_URL"
echo ""

# Step 4: Attempt merge
echo "Step 4: Attempting merge (squash + delete branch)..."
if gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --delete-branch \
  --subject "$TITLE" \
  --body "Add Logicville playbooks to OS, Tools governance card, playbook sync utilities and Playwright smoke test." 2>&1; then
  echo ""
  echo "  ✓ PR #$PR_NUMBER merged successfully!"
else
  echo ""
  echo "  ⚠ Merge blocked (CI checks pending or review required)."
  echo ""
  echo "  Next steps:"
  echo "    1. Open $PR_URL and check CI status"
  echo "    2. Wait for checks to pass and get approvals"
  echo "    3. Then run:"
  echo "       gh pr merge $PR_NUMBER --repo $REPO --squash --delete-branch"
fi

echo ""
echo "Done."
