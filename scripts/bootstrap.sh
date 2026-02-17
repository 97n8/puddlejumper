#!/usr/bin/env bash
# scripts/bootstrap.sh — Idempotent local dev setup for PuddleJumper
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_ROOT="$REPO_ROOT/n8drive"
if [[ ! -d "$WORKSPACE_ROOT" ]]; then
  echo "Workspace directory missing: $WORKSPACE_ROOT"
  exit 1
fi
cd "$WORKSPACE_ROOT"
echo "=== PuddleJumper Bootstrap — $(date) ==="
echo "Repo root: $REPO_ROOT"
echo "Workspace root: $WORKSPACE_ROOT"

# Ensure nvm installed and loaded
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "Installing nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
fi
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install & use Node 20
nvm install 20
nvm use 20
echo "node: $(node -v)  npm: $(npm -v)"

# Enable corepack + pnpm that matches CI
corepack enable
corepack prepare pnpm@8.15.8 --activate
echo "pnpm: $(pnpm -v)"

# Install workspace dependencies (prefer frozen lockfile)
echo "Installing dependencies..."
if [ -d "$WORKSPACE_ROOT/node_modules" ]; then
  echo "Removing stale node_modules to rebuild native addons."
  rm -rf "$WORKSPACE_ROOT/node_modules"
fi
if pnpm install --frozen-lockfile >/dev/null 2>&1; then
  echo "Dependencies installed (frozen-lockfile)."
else
  echo "frozen-lockfile failed; running pnpm install..."
  pnpm install
fi

# Copy .env.sample -> .env if missing
if [ -f ".env.sample" ] && [ ! -f ".env" ]; then
  cp .env.sample .env
  echo ".env created from .env.sample (edit values as needed)"
fi

# Build workspace or app (best-effort)
if pnpm -w -s build >/dev/null 2>&1; then
  echo "Workspace build ok."
else
  echo "Top-level build missing/failed; trying apps/puddlejumper build..."
  if [ -d "apps/puddlejumper" ]; then
    (cd apps/puddlejumper && pnpm build) || echo "apps/puddlejumper build missing/failed."
  fi
fi

# Create ignored data dir at repo root
mkdir -p "$REPO_ROOT/data"

# Typecheck / contract check (non-fatal)
pnpm -w -s typecheck 2>/dev/null || echo "typecheck skipped/failed"
pnpm -w -s check:pj-contract 2>/dev/null || echo "contract check skipped/failed"

# Run unit tests (best-effort)
if pnpm -w -s test >/dev/null 2>&1; then
  echo "Workspace tests OK."
else
  echo "Workspace tests failed/absent; trying apps/puddlejumper tests..."
  if [ -d "apps/puddlejumper" ]; then
    (cd apps/puddlejumper && pnpm test) || echo "apps/puddlejumper tests failed/absent."
  fi
fi

# Attempt to install Playwright browsers (best-effort)
if pnpm exec playwright install --with-deps >/dev/null 2>&1; then
  echo "Playwright browsers + deps installed."
else
  pnpm exec playwright install >/dev/null 2>&1 || echo "Playwright install skipped/failed."
fi

echo
echo "Bootstrap finished. Next steps:"
echo "  cd apps/puddlejumper && pnpm dev"
echo "=== DONE $(date) ==="
