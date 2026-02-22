#!/bin/bash
# PuddleJumper local smoke test — run from repo root
set -e

echo "=== PuddleJumper Smoke Test ==="

# 1. Install (pnpm workspace)
echo "Installing deps..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
else
  npm install --prefix n8drive
fi

# 2. Build
echo "Building..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm -w -r build || npx tsc -b --verbose
else
  (cd n8drive && npm run build) || npx tsc -b --verbose
fi

# 3. Env vars
echo "Setting env..."
export PJ_CONTROLLED_DATA_DIR="$(pwd)/data"
export PRR_DB_PATH="$(pwd)/data/prr.db"
export CONNECTOR_DB_PATH="$(pwd)/data/connectors.db"
export IDEMPOTENCY_DB_PATH="$(pwd)/data/idempotency.db"
export RATE_LIMIT_DB_PATH="$(pwd)/data/rate-limit.db"
export ACCESS_NOTIFICATION_WEBHOOK_URL="https://placeholder-webhook.invalid"
export PJ_RUNTIME_CONTEXT_JSON='{"workspace":{"id":"town","name":"Town Workspace"}}'
export PJ_RUNTIME_TILES_JSON='[{"id":"dashboard","label":"Dashboard"}]'
export PJ_RUNTIME_CAPABILITIES_JSON='{"quickActions":["health_check"]}'
export JWT_SECRET=$(openssl rand -hex 32)
export CONNECTOR_STATE_SECRET=$(openssl rand -hex 32)
export NODE_ENV=development
export PORT=3002

# 4. Data dir
mkdir -p ./data

# 5. Start server (from puddlejumper app)
echo "Starting server on 3002..."
cd n8drive/apps/puddlejumper
node dist/api/server.js & echo $! > /tmp/pj_pid
cd ../../..

# 6. Wait
sleep 5

# 7. Tests
echo "=== Root headers ==="
curl -I http://localhost:3002/ | head -10

echo "=== /health ==="
curl -s http://localhost:3002/health | jq .

echo "=== /live ==="
curl -s http://localhost:3002/live | jq .

echo "=== DB files ==="
ls -la ./data/*.db || echo "No DB files (normal if no writes)"

# 8. Cleanup
kill $(cat /tmp/pj_pid) 2>/dev/null || true
rm -f /tmp/pj_pid

echo "=== Done === If /health & /live 200 → server healthy! ==="
