#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${DEPLOY_REPO_ROOT:-$(pwd)}"
CONTENT_FILE_PATH="${CONTENT_FILE_PATH:-}"

if [[ -z "$CONTENT_FILE_PATH" ]]; then
  echo "CONTENT_FILE_PATH is required." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but was not found in PATH." >&2
  exit 1
fi

cd "$REPO_ROOT"

if [[ ! -f "$CONTENT_FILE_PATH" ]]; then
  echo "Content file does not exist: $CONTENT_FILE_PATH" >&2
  exit 1
fi

git add "$CONTENT_FILE_PATH"

if git diff --cached --quiet; then
  echo "No staged changes detected; skipping commit and push."
  exit 0
fi

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
git commit -m "Operator deploy ${timestamp}"

branch="$(git rev-parse --abbrev-ref HEAD)"
git push origin "$branch"

echo "Deploy trigger committed and pushed on branch '$branch'."
