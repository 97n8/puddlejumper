#!/usr/bin/env bash
set -e

echo "== Deploying PublicLogic HMLP under /hmlp =="

# 1. Ensure Vite base path is correct
cat > client/vite.config.js <<'VITE'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/hmlp/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
VITE

echo "✅ Vite base set to /hmlp/"

# 2. Install deps
npm install
npm install --prefix client

# 3. Build
npm run build --prefix client

# 4. Verify output
if [ ! -d "client/dist/assets" ]; then
  echo "❌ Build failed: client/dist/assets missing"
  exit 1
fi

# 5. Stage under public/hmlp
rm -rf public/hmlp
mkdir -p public/hmlp
cp -R client/dist/* public/hmlp/

echo "✅ Build staged at public/hmlp"

# 6. Minimal routing (SAFE for root site)
cat > vercel.json <<'JSON'
{
  "routes": [
    { "src": "^/hmlp$", "dest": "/hmlp/index.html" },
    { "src": "^/hmlp/(.*)", "dest": "/hmlp/$1" }
  ]
}
JSON

echo "✅ vercel.json written"

# 7. Deploy
vercel deploy --prod --yes

echo "🚀 DEPLOY COMPLETE"
echo "➡️ https://www.publiclogic.org/hmlp"
