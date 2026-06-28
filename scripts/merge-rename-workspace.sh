#!/usr/bin/env bash
# merge-rename-workspace.sh
#
# Rename LogicOS branding to Workspace inside apps/workspace/ ONLY.
# Carves out LogicCommons, LogicDocs, LogicBackend — these are feature names
# inside the workspace, not the workspace itself.
#
# Usage:
#   ./scripts/merge-rename-workspace.sh              # dry-run, prints what would change
#   ./scripts/merge-rename-workspace.sh --apply      # actually write changes
#   ./scripts/merge-rename-workspace.sh --verify     # post-pass check for orphan LogicOS references
#
# Idempotent: running --apply twice is safe; second run is a no-op.
# Scope: never touches anything outside apps/workspace/.
# Safety: if apps/workspace/ doesn't exist, exits with error before doing anything.

set -euo pipefail

MODE_ARG="${1:-}"
case "$MODE_ARG" in
  --apply)  MODE=apply ;;
  --verify) MODE=verify ;;
  --dry-run|"") MODE=dryrun ;;
  *) echo "Usage: $0 [--apply|--verify|--dry-run]" >&2; exit 2 ;;
esac

# Find repo root (must contain apps/workspace/)
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TARGET="$REPO_ROOT/apps/workspace"

if [[ ! -d "$TARGET" ]]; then
  echo "ERROR: $TARGET does not exist. Run this after the subtree merge." >&2
  exit 1
fi

# Sentinels — UUID-based, vanishingly unlikely to occur naturally.
# These get swapped in for protected tokens, the global rename runs, then they get swapped back.
# Three case variants per protected name: PascalCase, lowercase, UPPERCASE.
SENTINEL_COMMONS="__PROTECT_a3f9d1c8_LogicCommons_a3f9d1c8__"
SENTINEL_COMMONS_LC="__PROTECT_a3f9d1c8_logiccommons_a3f9d1c8__"
SENTINEL_COMMONS_UC="__PROTECT_a3f9d1c8_LOGICCOMMONS_a3f9d1c8__"
SENTINEL_DOCS="__PROTECT_b7e2a4d6_LogicDocs_b7e2a4d6__"
SENTINEL_DOCS_LC="__PROTECT_b7e2a4d6_logicdocs_b7e2a4d6__"
SENTINEL_DOCS_UC="__PROTECT_b7e2a4d6_LOGICDOCS_b7e2a4d6__"
SENTINEL_BACKEND="__PROTECT_c5d8b2e1_LogicBackend_c5d8b2e1__"
SENTINEL_BACKEND_LC="__PROTECT_c5d8b2e1_logicbackend_c5d8b2e1__"
SENTINEL_BACKEND_UC="__PROTECT_c5d8b2e1_LOGICBACKEND_c5d8b2e1__"

# File extensions to process. Add more if needed.
EXTS=(ts tsx js jsx mjs cjs json md mdx css scss html yaml yml txt sh)

# Build a find expression for the target extensions, plus env files (no extension).
FIND_ARGS=(-type f \()
for i in "${!EXTS[@]}"; do
  if [[ $i -gt 0 ]]; then FIND_ARGS+=(-o); fi
  FIND_ARGS+=(-name "*.${EXTS[$i]}")
done
# Env files: .env, .env.example, .env.local, .env.production, etc.
FIND_ARGS+=(-o -name ".env" -o -name ".env.*")
FIND_ARGS+=(\))

# Exclude node_modules, dist, build, .next, .turbo, coverage
FIND_ARGS+=(
  -not -path "*/node_modules/*"
  -not -path "*/dist/*"
  -not -path "*/build/*"
  -not -path "*/.next/*"
  -not -path "*/.turbo/*"
  -not -path "*/coverage/*"
)

# Collect file list once so we don't rescan.
FILES=()
while IFS= read -r -d '' file; do
  FILES+=("$file")
done < <(find "$TARGET" "${FIND_ARGS[@]}" -print0)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No files matched under $TARGET. Nothing to do." >&2
  exit 0
fi

# -----------------------------------------------------------------------------
# VERIFY MODE — post-pass orphan check
# -----------------------------------------------------------------------------
if [[ "$MODE" == "verify" ]]; then
  echo "Verifying: scanning for orphan LogicOS references inside $TARGET..."
  echo "(Expected: only LogicCommons, LogicDocs, LogicBackend should match)"
  echo ""
  ORPHANS=0
  for f in "${FILES[@]}"; do
    # Keep the internal logicos module/test/API namespace for now. Phase 3 is
    # user-facing brand cleanup, not a deep internal package/database rename.
    case "$f" in
      */src/lib/logicos/*|*/src/test/logicos/*|*/api/logicos/*) continue ;;
    esac
    # Match any LogicOS variant (PascalCase/lowercase/UPPERCASE/hyphenated)
    # that is NOT part of LogicCommons / LogicDocs / LogicBackend (any case).
    if grep -nEi 'logicos|logic-os' "$f" 2>/dev/null | grep -vEi 'logiccommons|logicdocs|logicbackend' > /tmp/rename_verify_$$ 2>/dev/null; then
      if [[ -s /tmp/rename_verify_$$ ]]; then
        echo "ORPHAN: $f"
        cat /tmp/rename_verify_$$ | sed 's/^/  /'
        ORPHANS=$((ORPHANS + 1))
      fi
    fi
  done
  rm -f /tmp/rename_verify_$$
  if [[ $ORPHANS -gt 0 ]]; then
    echo ""
    echo "Found $ORPHANS files with orphan references. Investigate before opening PR." >&2
    exit 1
  else
    echo "Clean. No orphan LogicOS references found."
  fi
  exit 0
fi

# -----------------------------------------------------------------------------
# DRYRUN / APPLY — show or perform replacements
# -----------------------------------------------------------------------------
TMPDIR="$(mktemp -d)"
trap "rm -rf $TMPDIR" EXIT

CHANGED=0
WOULD_CHANGE=0

for f in "${FILES[@]}"; do
  # Skip binary files defensively (find should have, but be safe).
  if ! grep -Iq . "$f" 2>/dev/null; then
    continue
  fi

  WORK="$TMPDIR/$(basename "$f")"

  # Step 1: protect feature names with sentinels.
  # Order matters — longer first so LogicCommons isn't half-matched.
  # All three case variants per name: PascalCase, lowercase, UPPERCASE.
  sed \
    -e "s/LogicCommons/${SENTINEL_COMMONS}/g" \
    -e "s/logiccommons/${SENTINEL_COMMONS_LC}/g" \
    -e "s/LOGICCOMMONS/${SENTINEL_COMMONS_UC}/g" \
    -e "s/LogicBackend/${SENTINEL_BACKEND}/g" \
    -e "s/logicbackend/${SENTINEL_BACKEND_LC}/g" \
    -e "s/LOGICBACKEND/${SENTINEL_BACKEND_UC}/g" \
    -e "s/LogicDocs/${SENTINEL_DOCS}/g" \
    -e "s/logicdocs/${SENTINEL_DOCS_LC}/g" \
    -e "s/LOGICDOCS/${SENTINEL_DOCS_UC}/g" \
    "$f" > "$WORK"

  # Step 2: apply the brand renames.
  # Specific-to-general order: hyphenated first, then lowercase, then PascalCase, then UPPERCASE.
  sed -i.bak \
    -e "s/logic-os/workspace/g" \
    -e "s/LOGIC-OS/WORKSPACE/g" \
    -e "s/logicos/workspace/g" \
    -e "s/Logicos/Workspace/g" \
    -e "s/LogicOS/Workspace/g" \
    -e "s/LOGICOS/WORKSPACE/g" \
    "$WORK"
  rm -f "${WORK}.bak"

  # Step 3: restore protected tokens (all three case variants).
  sed -i.bak \
    -e "s/${SENTINEL_COMMONS}/LogicCommons/g" \
    -e "s/${SENTINEL_COMMONS_LC}/logiccommons/g" \
    -e "s/${SENTINEL_COMMONS_UC}/LOGICCOMMONS/g" \
    -e "s/${SENTINEL_BACKEND}/LogicBackend/g" \
    -e "s/${SENTINEL_BACKEND_LC}/logicbackend/g" \
    -e "s/${SENTINEL_BACKEND_UC}/LOGICBACKEND/g" \
    -e "s/${SENTINEL_DOCS}/LogicDocs/g" \
    -e "s/${SENTINEL_DOCS_LC}/logicdocs/g" \
    -e "s/${SENTINEL_DOCS_UC}/LOGICDOCS/g" \
    "$WORK"
  rm -f "${WORK}.bak"

  # Compare.
  if ! cmp -s "$f" "$WORK"; then
    if [[ "$MODE" == "apply" ]]; then
      cp "$WORK" "$f"
      CHANGED=$((CHANGED + 1))
      echo "CHANGED: $f"
    else
      WOULD_CHANGE=$((WOULD_CHANGE + 1))
      echo "WOULD CHANGE: $f"
      # Show a unified diff snippet (first 20 lines of diff).
      # diff returns 1 when files differ; that's expected, suppress with || true.
      (diff -u "$f" "$WORK" || true) | head -n 22 | sed 's/^/  /'
      echo ""
    fi
  fi
done

echo ""
if [[ "$MODE" == "apply" ]]; then
  echo "Done. $CHANGED files modified."
  echo "Next: run '$0 --verify' to confirm no orphan LogicOS references remain."
else
  echo "Dry-run complete. $WOULD_CHANGE files would change."
  echo "To apply: $0 --apply"
fi
