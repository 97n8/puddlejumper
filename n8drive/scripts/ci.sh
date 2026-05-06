#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

trap 'docker rm -f pj-ci >/dev/null 2>&1 || true' EXIT

find . -name "*.tsbuildinfo" -type f -delete

pnpm --filter @publiclogic/core run build
pnpm --filter @publiclogic/logic-commons run build
pnpm --filter @publiclogic/puddlejumper run build

pnpm run typecheck
pnpm run check:pj-contract
pnpm --filter @publiclogic/core run test
pnpm --filter @publiclogic/puddlejumper run test
pnpm --filter @publiclogic/logic-commons run test

cat > .env.ci <<'EOF'
NODE_ENV=production
PORT=3002
JWT_SECRET=ci-test-secret-min-32-chars-long-0000000000
CONNECTOR_STATE_SECRET=ci-test-connector-secret
ACCESS_NOTIFICATION_WEBHOOK_URL=http://localhost:9999/noop
CONTROLLED_DATA_DIR=/app/data
AUTH_ISSUER=puddle-jumper
AUTH_AUDIENCE=puddle-jumper-api
PRR_DB_PATH=/app/data/prr.db
CONNECTOR_DB_PATH=/app/data/connectors.db
IDEMPOTENCY_DB_PATH=/app/data/idempotency.db
RATE_LIMIT_DB_PATH=/app/data/ratelimit.db
FRONTEND_URL=http://localhost:3000
PJ_RUNTIME_CONTEXT_JSON={"workspace":{"id":"ci-workspace","name":"CI","charter":{"authority":true,"accountability":true,"boundary":true,"continuity":true}},"municipality":{"id":"ci-municipality","name":"CI Town","state":"MA"}}
PJ_RUNTIME_TILES_JSON=[{"id":"ci-tile","label":"CI Tile","icon":"ci","mode":"governed","intent":"deploy_policy","target":"ci-workspace","tone":"operational","description":"CI smoke test tile"}]
PJ_RUNTIME_CAPABILITIES_JSON={"automations":[],"quickActions":[{"type":"action","trigger":["manual"],"title":"CI Action","icon":"ci","desc":"CI quick action","hint":"Run CI action"}]}
EOF

docker build -t publiclogic/puddlejumper:ci .
docker rm -f pj-ci >/dev/null 2>&1 || true
docker run -d --name pj-ci --env-file .env.ci -p 3002:3002 publiclogic/puddlejumper:ci >/dev/null

for _ in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health | grep -q 200; then
    exit 0
  fi
  sleep 1
done

docker logs pj-ci --tail 200
exit 1
