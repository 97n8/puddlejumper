#!/usr/bin/env bash
# scripts/bootstrap.sh — Idempotent local dev setup for PuddleJumper
# Run from repo root:  bash scripts/bootstrap.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== PuddleJumper Bootstrap — $(date) ==="
echo "Repo root: $REPO_ROOT"
echo

# ── 1. Check Node.js ────────────────────────────────────────────────────────
REQUIRED_NODE_MAJOR=20
CURRENT_NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])" 2>/dev/null || echo "0")

if [ "$CURRENT_NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  echo "✗ Node.js $REQUIRED_NODE_MAJOR+ required (found: $(node --version 2>/dev/null || echo 'none'))"
  echo
  echo "  Install via nvm:"
  echo "    nvm install $REQUIRED_NODE_MAJOR"
  echo "    nvm use $REQUIRED_NODE_MAJOR"
  echo
  echo "  Or via Homebrew (macOS):"
  echo "    brew install node@$REQUIRED_NODE_MAJOR"
  echo
  exit 1
fi
echo "✓ Node.js $(node --version)"

# ── 2. Enable corepack & pnpm ──────────────────────────────────────────────
echo "Enabling corepack + pnpm..."
corepack enable 2>/dev/null || true
corepack prepare pnpm@8.15.8 --activate 2>/dev/null || true
if ! command -v pnpm >/dev/null 2>&1; then
  echo "✗ pnpm not found. Install it:"
  echo "    corepack enable && corepack prepare pnpm@8.15.8 --activate"
  exit 1
fi
echo "✓ pnpm $(pnpm --version)"

# ── 3. Install dependencies ────────────────────────────────────────────────
echo
echo "Installing dependencies..."
cd "$REPO_ROOT/n8drive"
pnpm install
echo "✓ Dependencies installed"

# ── 4. Build packages in dependency order ───────────────────────────────────
echo
echo "Building packages..."
pnpm --filter @publiclogic/core run build
pnpm --filter @publiclogic/logic-commons run build
pnpm --filter @publiclogic/puddlejumper run build
echo "✓ Build complete"

# ── 5. Create local .env if missing ─────────────────────────────────────────
if [ ! -f "$REPO_ROOT/n8drive/.env" ]; then
  echo
  echo "Creating .env from .env.sample..."
  cp "$REPO_ROOT/n8drive/.env.sample" "$REPO_ROOT/n8drive/.env"
  # Generate random secrets for local dev
  if command -v openssl >/dev/null 2>&1; then
    JWT=$(openssl rand -hex 32)
    CONN=$(openssl rand -hex 32)
    sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$JWT/" "$REPO_ROOT/n8drive/.env"
    sed -i.bak "s/^CONNECTOR_STATE_SECRET=.*/CONNECTOR_STATE_SECRET=$CONN/" "$REPO_ROOT/n8drive/.env"
    rm -f "$REPO_ROOT/n8drive/.env.bak"
  fi
  echo "✓ .env created (edit it to add OAuth credentials if needed)"
else
  echo
  echo "✓ .env already exists"
fi

# ── 6. Create data directory ────────────────────────────────────────────────
mkdir -p "$REPO_ROOT/n8drive/data"
echo "✓ Data directory ready"

# ── 7. Run typecheck ────────────────────────────────────────────────────────
echo
echo "Running typecheck..."
if pnpm run typecheck; then
  echo "✓ Typecheck passed"
else
  echo "⚠ Typecheck had errors (non-blocking for dev)"
fi

# ── 8. Run contract check ──────────────────────────────────────────────────
echo
echo "Running PJ contract check..."
if pnpm run check:pj-contract; then
  echo "✓ Contract check passed"
else
  echo "⚠ Contract check failed"
fi

# ── 9. Run unit tests ──────────────────────────────────────────────────────
echo
echo "Running unit tests..."
if pnpm run test; then
  echo "✓ All tests passed"
else
  echo "⚠ Some tests failed (check output above)"
fi

# ── 10. Summary ─────────────────────────────────────────────────────────────
echo
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✓ PuddleJumper dev environment ready!              ║"
echo "║                                                      ║"
echo "║  Start the dev server:                               ║"
echo "║    cd n8drive && pnpm dev                            ║"
echo "║                                                      ║"
echo "║  Run tests:                                          ║"
echo "║    cd n8drive && pnpm test                           ║"
echo "║                                                      ║"
echo "║  Admin panel:  http://localhost:3002/pj/admin        ║"
echo "║  Health check: http://localhost:3002/health          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo
echo "=== DONE: $(date) ==="
