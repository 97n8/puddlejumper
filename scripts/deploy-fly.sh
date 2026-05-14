#!/bin/bash
# Deploy to Fly.io
set -e

echo "🛩️  Deploying PuddleJumper to Fly.io..."

# Build all packages
pnpm run build

# Deploy to Fly.io
fly deploy

echo "✅ Deployed to Fly.io!"