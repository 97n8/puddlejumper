#!/usr/bin/env bash
set -euo pipefail

echo "== PublicLogic HMLP: build + prod deploy =="

# --- 1) Ensure correct Vite base (/hmlp) ---
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

# --- 2) Vercel config: scope to /hmlp only ---
cat > vercel.json <<'VERCEL'
{
  "buildCommand": "npm run build --prefix client",
  "outputDirectory": "client/dist",
  "routes": [
    { "src": "^/hmlp/?$", "dest": "/hmlp/index.html" },
    { "src": "^/hmlp/(.*)", "dest": "/hmlp/$1" }
  ]
}
VERCEL

# --- 3) Install deps ---
npm install
npm install --prefix client

# --- 4) Build ---
npm run build --prefix client

# --- 5) Verify output ---
if [ ! -d "client/dist" ]; then
  echo "❌ ERROR: client/dist not found"
  exit 1
fi
echo "✅ client/dist verified"

# --- 6) Pull Vercel project config ---
vercel pull --yes

# --- 7) Build with Vercel (production target) ---
vercel build --prod

# --- 8) Deploy prebuilt to production ---
vercel deploy --prebuilt --prod --yes

echo "🚀 HMLP deployed at /hmlp (root untouched)"
