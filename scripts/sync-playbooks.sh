#!/usr/bin/env bash
# sync-playbooks.sh — Keep the three playbook directories in sync.
#
# Canonical source for playbook markdown files:
#   publiclogic-operating-system/
#
# UI copies (must stay identical to each other):
#   publiclogic-os-ui/content/playbooks/
#   publiclogic-site/HMLP/content/playbooks/
#
# The UI copies also contain index.json (not present in the OS dir).
# This script syncs markdown from OS → UI copies, and index.json between UI copies.
#
# Usage:
#   ./scripts/sync-playbooks.sh          # default: sync
#   ./scripts/sync-playbooks.sh --check  # dry-run: report drift, exit 1 if out of sync

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

OS_DIR="$REPO_ROOT/publiclogic-operating-system"
UI_DIR="$REPO_ROOT/publiclogic-os-ui/content/playbooks"
SITE_DIR="$REPO_ROOT/publiclogic-site/HMLP/content/playbooks"

CHECK_ONLY=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
fi

DRIFT=0

# --- Helper: compare a single file between two directories ---
compare_file() {
  local file="$1"
  local src_dir="$2"
  local dst_dir="$3"
  local src="$src_dir/$file"
  local dst="$dst_dir/$file"

  if [[ ! -f "$src" ]]; then
    return 0
  fi

  if [[ ! -f "$dst" ]]; then
    echo "  MISSING  $dst"
    DRIFT=1
    return 0
  fi

  if ! diff -q "$src" "$dst" > /dev/null 2>&1; then
    echo "  DIFFERS  $dst"
    DRIFT=1
  fi
}

# --- Helper: copy a single file ---
copy_file() {
  local file="$1"
  local src_dir="$2"
  local dst_dir="$3"
  local src="$src_dir/$file"
  local dst="$dst_dir/$file"

  if [[ ! -f "$src" ]]; then
    return 0
  fi

  if [[ -f "$dst" ]] && diff -q "$src" "$dst" > /dev/null 2>&1; then
    return 0
  fi

  cp "$src" "$dst"
  echo "  SYNCED   $file → $dst_dir/"
}

# --- 1. Sync playbook markdown files: OS → UI copies ---
echo "Checking playbook markdown files (OS → UI copies)..."

for md in "$OS_DIR"/*.md; do
  filename="$(basename "$md")"
  # Skip the OS-specific README (it differs intentionally)
  if [[ "$filename" == "README.md" ]]; then
    continue
  fi

  if $CHECK_ONLY; then
    compare_file "$filename" "$OS_DIR" "$UI_DIR"
    compare_file "$filename" "$OS_DIR" "$SITE_DIR"
  else
    copy_file "$filename" "$OS_DIR" "$UI_DIR"
    copy_file "$filename" "$OS_DIR" "$SITE_DIR"
  fi
done

# --- 2. Sync index.json between UI copies ---
echo "Checking index.json (OS-UI ↔ HMLP site)..."

if $CHECK_ONLY; then
  compare_file "index.json" "$UI_DIR" "$SITE_DIR"
else
  copy_file "index.json" "$UI_DIR" "$SITE_DIR"
fi

# --- 3. Check for markdown files in UI dirs that are missing from OS ---
echo "Checking for UI-only markdown files not in OS..."

for md in "$UI_DIR"/*.md; do
  filename="$(basename "$md")"
  if [[ "$filename" == "README.md" ]]; then
    continue
  fi
  if [[ ! -f "$OS_DIR/$filename" ]]; then
    echo "  WARNING  $filename exists in UI but not in OS (canonical source). Move it to OS or remove it from UI."
    DRIFT=1
  fi
done

# --- Summary ---
if $CHECK_ONLY; then
  if [[ $DRIFT -eq 0 ]]; then
    echo "✓ All playbook files are in sync."
    exit 0
  else
    echo "✗ Drift detected. Run ./scripts/sync-playbooks.sh to fix."
    exit 1
  fi
else
  echo "✓ Playbook sync complete."
fi
