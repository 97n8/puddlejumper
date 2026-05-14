#!/bin/sh
set -eu

DATA_DIR="${CONTROLLED_DATA_DIR:-${DATA_DIR:-/app/data}}"
APPROVAL_DB_PATH="${APPROVAL_DB_PATH:-$DATA_DIR/approvals.db}"
PRR_DB_PATH="${PRR_DB_PATH:-$DATA_DIR/prr.db}"
CONNECTOR_DB_PATH="${CONNECTOR_DB_PATH:-$DATA_DIR/connectors.db}"
IDEMPOTENCY_DB_PATH="${IDEMPOTENCY_DB_PATH:-$DATA_DIR/idempotency.db}"
RATE_LIMIT_DB_PATH="${RATE_LIMIT_DB_PATH:-$DATA_DIR/rate-limit.db}"

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# Change ownership to node user (uid:1000, gid:1000)
# Volume mounts start as root-owned, we need to fix that
chown -R node:node "$DATA_DIR" || true

# Ensure directory is writable by owner/group
chmod -R ug+rwX "$DATA_DIR" || true

# Fail fast with clear diagnostics if the mounted directory is still not writable.
if ! gosu node sh -c "test -w \"$DATA_DIR\""; then
  echo "ERROR: data directory is not writable for node user: $DATA_DIR" >&2
  ls -ld "$DATA_DIR" >&2 || true
  exit 1
fi

ensure_db_file_writable() {
  db_path="$1"
  db_dir="$(dirname "$db_path")"
  mkdir -p "$db_dir"
  chown -R node:node "$db_dir" || true
  chmod -R ug+rwX "$db_dir" || true

  if ! gosu node sh -c "touch \"$db_path\""; then
    echo "ERROR: sqlite path is not writable for node user: $db_path" >&2
    ls -ld "$db_dir" >&2 || true
    exit 1
  fi
}

ensure_db_file_writable "$APPROVAL_DB_PATH"
ensure_db_file_writable "$PRR_DB_PATH"
ensure_db_file_writable "$CONNECTOR_DB_PATH"
ensure_db_file_writable "$IDEMPOTENCY_DB_PATH"
ensure_db_file_writable "$RATE_LIMIT_DB_PATH"

# Start Next.js standalone server in background (production only)
if [ "${NODE_ENV:-}" = "production" ]; then
  echo "[entrypoint] Starting Next.js server on port 3003..."
  gosu node sh -c "cd /app/web-standalone/web && PORT=3003 node server.js" > /tmp/nextjs.log 2>&1 &
  NEXTJS_PID=$!
  echo "[entrypoint] Next.js server started (PID: $NEXTJS_PID)"
  
  # Give Next.js a moment to bind to port
  sleep 3
fi

# Start Express server (foreground)
echo "[entrypoint] Starting Express server on port ${PORT:-3002}..."
exec gosu node "$@"
