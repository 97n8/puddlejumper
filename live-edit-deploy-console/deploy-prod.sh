#!/usr/bin/env bash
set -e

echo "== PublicLogic: local build + prebuilt deploy =="

# Ensure correct git identity
git config --global user.name "97n8"
git config --global user.email "nboudreauma@gmail.com"

# Correct Vercel config for monorepo
cat > vercel.json <<'JSON'
{
  "buildCommand": "npm run build --prefix client",
  "outputDirectory": "client/dist"
}
JSON

# Install dependencies
npm install
npm install --prefix client

# Build client
npm run build --prefix client

# Verify output
if [ ! -d "client/dist" ]; then
  echo "❌ client/dist not found"
  exit 1
fi

echo "✅ client/dist verified"

# Pull Vercel project config
vercel pull --yes

# Build with Vercel
vercel build

# Deploy prebuilt output
vercel deploy --prebuilt --prod --yes

echo "🚀 Production deployment complete"
