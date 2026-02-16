#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Configuration - edit if needed
# -----------------------------
REPO="97n8/puddlejumper"
BRANCH="copilot/review-pr-41-merge"
PR_TITLE="feat(os): Logicville playbooks, governance card, sync scripts, smoke test"
PR_BODY=$'Summary:\n\n- Adds canonical Logicville playbooks to publiclogic-operating-system/\n- Adds "Logicville — Governance" card to Tools page (Agenda / Playbooks / optional PuddleJumper Admin)\n- Adds playbook sync utilities (scripts/sync-playbooks.sh and scripts/sync-playbooks.js) with --check mode for CI\n- Adds Playwright smoke test (tests/e2e/tools-smoke.spec.ts)\n\nNotes:\n- Does not change n8drive/ (no conflict with backend PRs)\n- Playwright smoke test expects a dev or staging server serving the OS UI at http://localhost:3000 (adjust in CI if needed)\n'

MERGE_SUBJECT="feat(os): Logicville playbooks, governance card, sync scripts, smoke test"
MERGE_BODY="Merge Logicville OS work (playbooks, governance Tools card, sync utilities, Playwright smoke test)."

# -----------------------------
# Helper: print & run
# -----------------------------
run() { echo "+ $*"; "$@"; }

echo "Working directory: $(pwd)"
echo "Repository: $REPO"
echo "Branch: $BRANCH"
echo

# Ensure we're in a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Not inside a git repository. cd to the repo root and retry."
  exit 1
fi

# Ensure gh is available
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) not found. Please install/enable it and run 'gh auth login'."
  exit 1
fi

# Ensure no uncommitted changes the user doesn't want to commit (warn and proceed)
if ! git diff --quiet || ! git diff --staged --quiet; then
  echo "You have uncommitted changes. This script will commit them to branch: $BRANCH."
  read -p "Continue and commit all changes? [y/N] " yn
  if [[ "${yn:-N}" != "y" && "${yn:-N}" != "Y" ]]; then
    echo "Aborting."
    exit 1
  fi
fi

# Check out branch (create if missing)
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  run git checkout "${BRANCH}"
else
  echo "Branch ${BRANCH} doesn't exist locally. Creating from current HEAD."
  run git checkout -b "${BRANCH}"
fi

# Add and commit everything if there are changes
if ! git diff --quiet || ! git diff --staged --quiet; then
  run git add -A
  run git commit -m "${PR_TITLE}"
else
  echo "No local changes to commit."
fi

# Push branch
run git push -u origin "${BRANCH}"

# Create PR (if it exists, capture it)
echo "Creating PR for branch ${BRANCH}..."
PR_JSON=$(gh pr create --repo "${REPO}" --title "${PR_TITLE}" --body "${PR_BODY}" --base main --head "${BRANCH}" --json number,url 2>/dev/null) || {
  # if PR exists, find it
  echo "gh pr create failed - attempting to find existing PR for branch ${BRANCH}..."
  PR_JSON=$(gh pr list --repo "${REPO}" --head "${BRANCH}" --state open --json number,url --jq '.[0]' )
  if [[ -z "${PR_JSON}" || "${PR_JSON}" == "null" ]]; then
    echo "ERROR: Could not create or find PR for branch ${BRANCH}. Please check manually."
    exit 1
  fi
}

PR_NUMBER=$(echo "${PR_JSON}" | jq -r '.number')
PR_URL=$(echo "${PR_JSON}" | jq -r '.url')
if [[ "${PR_NUMBER}" == "null" || -z "${PR_NUMBER}" ]]; then
  echo "ERROR: Failed to obtain PR number. PR output:"
  echo "${PR_JSON}"
  exit 1
fi

echo "Created/open PR #${PR_NUMBER}: ${PR_URL}"

# Try to auto-merge PR #${PR_NUMBER} (squash + delete branch)
# Note: gh will refuse if required checks fail. We try and if it fails, report and exit.
echo "Attempting to merge PR #${PR_NUMBER} (squash + delete branch)..."
if gh pr merge "${PR_NUMBER}" --repo "${REPO}" --squash --delete-branch --subject "${MERGE_SUBJECT}" --body "${MERGE_BODY}" >/dev/null 2>&1; then
  echo "PR #${PR_NUMBER} merged successfully."
else
  echo "Automatic merge failed. This is usually because checks have not completed or a required check failed."
  echo "Open the PR to inspect CI / review status: ${PR_URL}"
  echo "You can re-run the merge command after CI passes:"
  echo "  gh pr merge ${PR_NUMBER} --repo ${REPO} --squash --delete-branch --subject \"${MERGE_SUBJECT}\" --body \"${MERGE_BODY}\""
  # Attempt to close PR #41 if it exists and is open (to avoid duplication)
  if gh pr view 41 --repo "${REPO}" >/dev/null 2>&1; then
    echo "PR #41 exists. Will attempt to close it to avoid duplicate merges..."
    gh pr close 41 --repo "${REPO}" --delete-branch || true
  fi
  exit 0
fi

# On successful merge, attempt to close PR #41 (if open)
if gh pr view 41 --repo "${REPO}" >/dev/null 2>&1; then
  echo "Closing PR #41 (duplicate/original Logicville branch) if still open..."
  gh pr close 41 --repo "${REPO}" --delete-branch || true
fi

echo "Done. PR merged and branch cleaned up."
echo "Verify CI on main and the Tools page in staging to ensure everything deployed correctly."
