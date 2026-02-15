#!/bin/sh
set -e

DATA_DIR="${CONTROLLED_DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR"

exec gosu node "$@"
