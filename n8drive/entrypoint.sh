#!/bin/sh
set -e

DATA_DIR="${CONTROLLED_DATA_DIR:-/app/data}"

# Ensure data directory exists and is writable by node (uid 1000)
mkdir -p "$DATA_DIR"
chown -R 1000:1000 "$DATA_DIR"

# Drop privileges and exec the main process
exec gosu node "$@"
