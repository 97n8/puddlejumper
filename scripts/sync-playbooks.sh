#!/usr/bin/env bash
# sync-playbooks.sh — Keep HMLP app and playbook content in sync.
#
# Canonical source for the HMLP app (all app code):
#   publiclogic-os-ui/           (independently deployed to Netlify)
#
# Derived copy (mirrors publiclogic-os-ui for embedded site deployment):
#   publiclogic-site/HMLP/       (embedded in the public site, also Netlify)
#
# Canonical source for playbook markdown files:
#   publiclogic-operating-system/
#
# Sync rules:
#   1. App code: publiclogic-os-ui/ → publiclogic-site/HMLP/ (all non-config files)
#   2. Playbook markdown: publiclogic-operating-system/ → both content/playbooks/ dirs
#   3. index.json: publiclogic-os-ui/content/playbooks/ → publiclogic-site/HMLP/content/playbooks/
#
# config.js / config.example.js are NOT synced — they differ intentionally
# between deployments (different API URLs, feature flags, etc.).
#
# Usage:
#   ./scripts/sync-playbooks.sh          # default: sync
#   ./scripts/sync-playbooks.sh --check  # dry-run: report drift, exit 1 if out of sync

set -euo pipefail
shopt -s nullglob

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

OS_DIR="$REPO_ROOT/publiclogic-operating-system"
UI_APP_DIR="$REPO_ROOT/publiclogic-os-ui"
SITE_APP_DIR="$REPO_ROOT/publiclogic-site/HMLP"
UI_DIR="$UI_APP_DIR/content/playbooks"
SITE_DIR="$SITE_APP_DIR/content/playbooks"

# App-level files that must stay in sync (config files excluded — they differ per deployment)
APP_SYNC_FILES=(app.js index.html styles.css)

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

# --- 1. Sync app code: publiclogic-os-ui/ → publiclogic-site/HMLP/ ---
# publiclogic-os-ui/ is the canonical source for all HMLP app code.
# publiclogic-site/HMLP/ is a mirror embedded in the public site deployment.
# config.js and config.example.js differ intentionally and are NOT synced.
echo "Checking HMLP app code (publiclogic-os-ui/ → publiclogic-site/HMLP/)..."

for file in "${APP_SYNC_FILES[@]}"; do
  if $CHECK_ONLY; then
    compare_file "$file" "$UI_APP_DIR" "$SITE_APP_DIR"
  else
    copy_file "$file" "$UI_APP_DIR" "$SITE_APP_DIR"
  fi
done

# --- 2. Sync playbook markdown files: OS → UI copies ---
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

# --- 3. Sync index.json between UI copies ---
echo "Checking index.json (OS-UI ↔ HMLP site)..."

if $CHECK_ONLY; then
  compare_file "index.json" "$UI_DIR" "$SITE_DIR"
else
  copy_file "index.json" "$UI_DIR" "$SITE_DIR"
fi

# --- 4. Check for markdown files in UI dirs that are missing from OS ---
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
