#!/usr/bin/env bash
# ── Playbook Sync Utility ────────────────────────────────────────────────────
#
# Keeps playbook markdown files in sync across the three locations:
#   1. publiclogic-operating-system/          (canonical source)
#   2. publiclogic-os-ui/content/playbooks/   (OS UI content)
#   3. publiclogic-site/HMLP/content/playbooks/ (HMLP mirror)
#
# Usage:
#   ./scripts/sync-playbooks.sh          # Copy canonical → UI + HMLP
#   ./scripts/sync-playbooks.sh --check  # Check for drift (CI-friendly, exits 1 if out of sync)
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

CANONICAL="$REPO_ROOT/publiclogic-operating-system"
UI_PLAYBOOKS="$REPO_ROOT/publiclogic-os-ui/content/playbooks"
HMLP_PLAYBOOKS="$REPO_ROOT/publiclogic-site/HMLP/content/playbooks"

CHECK_MODE=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_MODE=true
fi

drift=0

for md in "$CANONICAL"/*.md; do
  filename="$(basename "$md")"

  # Skip README.md — it's directory-specific, not a playbook
  if [[ "$filename" == "README.md" ]]; then
    continue
  fi

  # Check UI copy
  if [[ -f "$UI_PLAYBOOKS/$filename" ]]; then
    if ! diff -q "$md" "$UI_PLAYBOOKS/$filename" > /dev/null 2>&1; then
      echo "DRIFT: $filename differs between canonical and publiclogic-os-ui"
      drift=1
    fi
  else
    echo "MISSING: $filename not found in publiclogic-os-ui/content/playbooks/"
    drift=1
  fi

  # Check HMLP copy
  if [[ -f "$HMLP_PLAYBOOKS/$filename" ]]; then
    if ! diff -q "$md" "$HMLP_PLAYBOOKS/$filename" > /dev/null 2>&1; then
      echo "DRIFT: $filename differs between canonical and publiclogic-site/HMLP"
      drift=1
    fi
  else
    echo "MISSING: $filename not found in publiclogic-site/HMLP/content/playbooks/"
    drift=1
  fi
done

if [[ "$CHECK_MODE" == true ]]; then
  if [[ $drift -eq 1 ]]; then
    echo ""
    echo "FAIL: Playbook drift detected. Run ./scripts/sync-playbooks.sh to fix."
    exit 1
  else
    echo "OK: All playbooks in sync across 3 locations."
    exit 0
  fi
fi

# Sync mode: copy canonical → targets
echo "Syncing playbooks from canonical source..."
for md in "$CANONICAL"/*.md; do
  filename="$(basename "$md")"
  if [[ "$filename" == "README.md" ]]; then
    continue
  fi
  cp "$md" "$UI_PLAYBOOKS/$filename"
  cp "$md" "$HMLP_PLAYBOOKS/$filename"
  echo "  ✓ $filename"
done

echo "Done. All playbooks synced."
