#!/bin/bash
# Deploy to Vercel
set -e

echo "🚀 Deploying PuddleJumper to Vercel..."

# Build all packages
pnpm run build

# Deploy puddlejumper app
cd apps/puddlejumper
vercel --prod

echo "✅ Deployed to Vercel!"