#!/usr/bin/env bash
set -euo pipefail

# ── PuddleJumper Release Gate ──
# Run before every deploy. Enforces architecture rules.
# Usage: pnpm ship (or bash scripts/ship.sh)
# // GPR

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAIL=0

echo "🦆 PuddleJumper Release Gate"
echo "──────────────────────────────"

# 1. No "wren" in new code
echo -n "Checking for retired name... "
if grep -rn "wren" --include="*.ts" --include="*.tsx" --include="*.js" apps/ packages/ 2>/dev/null | grep -v node_modules | grep -v ".turbo"; then
  echo -e "${RED}FAIL: 'wren' found in codebase. Remove it.${NC}"
  FAIL=1
else
  echo -e "${GREEN}OK${NC}"
fi

# 2. No KV imports (migrated to SQLite)
echo -n "Checking for KV imports... "
if grep -rn "@vercel/kv" --include="*.ts" --include="*.tsx" apps/ packages/ 2>/dev/null | grep -v node_modules; then
  echo -e "${RED}FAIL: @vercel/kv imports found. Use @pj/db.${NC}"
  FAIL=1
else
  echo -e "${GREEN}OK${NC}"
fi

# 3. TypeScript compiles
echo -n "Running typecheck... "
if pnpm turbo typecheck 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL: TypeScript errors.${NC}"
  FAIL=1
fi

# 4. Build succeeds
echo -n "Running build... "
if pnpm turbo build 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL: Build errors.${NC}"
  FAIL=1
fi

# 5. Audit triggers present in schema
echo -n "Checking audit trigger enforcement... "
if grep -q "audit_no_update" packages/db/src/index.ts && grep -q "audit_no_delete" packages/db/src/index.ts; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL: Audit triggers missing from schema.${NC}"
  FAIL=1
fi

echo "──────────────────────────────"
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🦆 All gates passed. Ship it.${NC}"
  exit 0
else
  echo -e "${RED}🛑 Release blocked. Fix the above.${NC}"
  exit 1
fi
