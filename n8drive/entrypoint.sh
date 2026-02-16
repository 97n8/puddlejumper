#!/bin/sh
set -e

DATA_DIR="${CONTROLLED_DATA_DIR:-/app/data}"

# Ensure data directory exists and is writable
mkdir -p "$DATA_DIR"

# Change ownership to node user (uid:1000, gid:1000)
# Volume mounts start as root-owned, we need to fix that
chown -R node:node "$DATA_DIR" || true

# Ensure directory is writable
chmod -R u+w "$DATA_DIR" || true

# Drop privileges and run as node user
exec gosu node "$@"
