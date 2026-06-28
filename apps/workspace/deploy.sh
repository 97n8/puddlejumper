#!/bin/bash
# Deploy Workspace frontend (Vercel) and/or PuddleJumper backend (Fly.io)
set -e

WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
PJ_DIR="${PJ_DIR:-$(cd "$(dirname "$0")/../puddlejumper/n8drive" && pwd)}"

deploy_frontend() {
  echo "🚀 Deploying Workspace frontend to Vercel..."
  (cd "$WORKSPACE_DIR" && vercel --prod)
  echo "✅ Workspace deployed!"
}

deploy_backend() {
  echo "🛩️  Deploying PuddleJumper backend to Fly.io..."
  (cd "$PJ_DIR" && pnpm run build && fly deploy)
  echo "✅ PuddleJumper deployed!"
}

case "${1:-}" in
  --all)
    deploy_frontend
    deploy_backend
    ;;
  --backend)
    deploy_backend
    ;;
  "")
    deploy_frontend
    ;;
  *)
    echo "Usage: $0 [--all | --backend]"
    echo "  (no args)   Deploy Workspace frontend to Vercel"
    echo "  --all       Deploy frontend + PuddleJumper backend"
    echo "  --backend   Deploy PuddleJumper backend only"
    echo ""
    echo "Env vars:"
    echo "  PJ_DIR      Path to PuddleJumper repo (default: ./puddlejumper/n8drive)"
    exit 1
    ;;
esac
