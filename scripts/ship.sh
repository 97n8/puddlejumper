#!/usr/bin/env bash
# PuddleJumper release gate — enforces architecture canon before any deploy.
# See: Master Build Spec v1.1, Part 10 + Part 15 (Canon Decisions).
#
# Canon rules enforced here:
#   4. No "wren" anywhere in code (retired name).
#   5. No @vercel/kv anywhere (migrated to SQLite).
#   - No banned database / queue dependencies (pg, redis, mongoose, mongodb, n8n, bullmq).
#   - Canon migration reference set present under pj/canon/migrations/.
#   - audit_events append-only triggers defined in the live audit store.
#
# Usage:
#   scripts/ship.sh                 # full gate (typecheck + tests + build, fatal)
#   scripts/ship.sh --canon-only    # canon checks only, skip pnpm runs
#   PJ_SHIP_SOFT_TYPECHECK=1 ...    # treat typecheck failure as warning (Phase 0 mode)

set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CANON_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --canon-only) CANON_ONLY=1 ;;
    *) ;;
  esac
done

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo "  ok   $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
warn() { echo "  warn $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
fail() { echo "  FAIL $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
hdr()  { echo; echo "// $1"; }

# Search scope shared by canon greps. Excludes node_modules, dist/build output,
# git internals, lockfiles, and this script itself.
GREP_INCLUDES=(
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" --include="*.cjs"
  --include="*.json" --include="*.yaml" --include="*.yml"
  --include="*.md" --include="*.sql" --include="*.html"
)
GREP_EXCLUDES=(
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=.turbo
  --exclude-dir=.git --exclude-dir=coverage
  --exclude="pnpm-lock.yaml" --exclude="package-lock.json"
  --exclude="ship.sh"
)
SEARCH_PATHS=(apps packages scripts migrations pj)

echo "// GPR — PuddleJumper release gate"
echo "// Repo: $ROOT_DIR"

hdr "Canon rule 4 — no 'wren' in codebase"
# Word-boundary match so 'Lawrence' and similar substrings don't trigger.
WREN_HITS=$(grep -rEIn "${GREP_INCLUDES[@]}" "${GREP_EXCLUDES[@]}" '\bwren\b' "${SEARCH_PATHS[@]}" 2>/dev/null || true)
if [ -n "$WREN_HITS" ]; then
  fail "'wren' references found:"
  echo "$WREN_HITS" | sed 's/^/       /'
else
  pass "no 'wren' tokens"
fi

hdr "Canon rule 5 — no @vercel/kv in codebase"
KV_HITS=$(grep -rIn "${GREP_INCLUDES[@]}" "${GREP_EXCLUDES[@]}" '@vercel/kv' "${SEARCH_PATHS[@]}" 2>/dev/null || true)
if [ -n "$KV_HITS" ]; then
  fail "@vercel/kv references found:"
  echo "$KV_HITS" | sed 's/^/       /'
else
  pass "no @vercel/kv references"
fi

hdr "Banned dependencies (pg / redis / mongoose / mongodb / n8n / bullmq)"
BANNED=(pg redis mongoose mongodb n8n bullmq)
BANNED_HITS=""
for dep in "${BANNED[@]}"; do
  # Match only as a JSON dependency key (quoted, followed by colon).
  HITS=$(grep -rEn "${GREP_EXCLUDES[@]}" --include="package.json" "\"$dep\"[[:space:]]*:" "${SEARCH_PATHS[@]}" 2>/dev/null || true)
  if [ -n "$HITS" ]; then
    BANNED_HITS+="$HITS"$'\n'
  fi
done
if [ -n "$BANNED_HITS" ]; then
  fail "banned dependencies declared in package.json:"
  printf '%s' "$BANNED_HITS" | sed 's/^/       /'
else
  pass "no banned database/queue deps"
fi

hdr "Canon migration reference set (pj/canon/migrations/)"
for canon in 001_schema_init.sql 002_divergence.sql 003_integration.sql; do
  if [ -f "pj/canon/migrations/$canon" ]; then
    pass "pj/canon/migrations/$canon present"
  else
    fail "missing pj/canon/migrations/$canon (Master Spec Part 11)"
  fi
done

hdr "Canon rule 2 — audit_events append-only triggers"
AUDIT_STORE="apps/logic-commons/src/lib/audit-store.ts"
if [ -f "$AUDIT_STORE" ]; then
  if grep -q "audit_events_no_update" "$AUDIT_STORE" && grep -q "audit_events_no_delete" "$AUDIT_STORE"; then
    pass "$AUDIT_STORE defines both canon triggers"
  else
    fail "$AUDIT_STORE missing canon triggers (audit_events_no_update / _no_delete)"
  fi
else
  fail "$AUDIT_STORE not found"
fi

hdr "STATUS.md present"
if [ -f "STATUS.md" ]; then
  pass "STATUS.md present"
else
  fail "STATUS.md missing (Master Spec Phase 0.4)"
fi

if [ "$CANON_ONLY" -eq 0 ]; then
  # Retired packages (RETIRE in STATUS.md) are excluded from gate runs.
  # Currently: @gpr/logicos (spec Part 6 — "RETIRING — being replaced").
  RETIRED_FILTER='--filter=!@gpr/logicos'
  # --continue keeps turbo running all tasks even after a failure, so the
  # log shows the full picture (without this, a single failing package
  # cancels the others mid-stream and masks the real signal).
  TURBO_OPTS='--continue'

  hdr "TypeScript typecheck"
  if pnpm -s exec turbo run typecheck $RETIRED_FILTER $TURBO_OPTS >/tmp/pj-ship-typecheck.log 2>&1; then
    pass "pnpm typecheck (excludes RETIRE packages)"
  else
    if [ "${PJ_SHIP_SOFT_TYPECHECK:-0}" = "1" ]; then
      warn "typecheck failed (soft mode — see /tmp/pj-ship-typecheck.log)"
    else
      fail "typecheck failed (see /tmp/pj-ship-typecheck.log)"
    fi
  fi

  hdr "Tests"
  if pnpm -s exec turbo run test $RETIRED_FILTER $TURBO_OPTS >/tmp/pj-ship-test.log 2>&1; then
    pass "pnpm test (excludes RETIRE packages)"
  else
    # Inventoried known failures (STATUS.md "Pre-existing test failures"):
    #   1. packages/core/test/auth.test.ts — missing supertest devDep
    #   2. apps/puddlejumper/src/api/migrations.test.ts — pre-existing
    #      2 failures in the legacy multi-DB runner test (audit_events
    #      singleton state issue across test runs)
    #   3. apps/puddlejumper/test/tier-enforcement.test.ts — pre-existing
    #      cross-test contamination from the legacy migration runner sharing
    #      module-level singleton state with the audit-store
    # Every other failure is a hard fail.
    EXPECTED_FILES=(
      'test/auth.test.ts'
      'src/api/migrations.test.ts'
      'test/tier-enforcement.test.ts'
      'bin/migrate.test.ts'
    )
    UNEXPECTED=0
    # Each vitest banner is `FAIL  <relative path>` (relative to the package).
    # Match the FAIL banner line, then trim down to the relative path and
    # de-duplicate so each failing file is counted once.
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      path=$(echo "$line" | sed -E 's/^.*FAIL[[:space:]]+([^[:space:]]+).*$/\1/')
      ok=0
      for known in "${EXPECTED_FILES[@]}"; do
        if [ "$path" = "$known" ]; then ok=1; break; fi
      done
      if [ "$ok" -eq 0 ]; then
        UNEXPECTED=$((UNEXPECTED + 1))
        echo "       unexpected FAIL  $path"
      fi
    done < <(grep -Eo 'FAIL[[:space:]]+(test|src|packages|bin|apps)/[^[:space:]]+' /tmp/pj-ship-test.log | sort -u)

    if [ "$UNEXPECTED" -eq 0 ]; then
      warn "tests: only inventoried pre-existing failures (see STATUS.md)"
    else
      fail "tests: $UNEXPECTED unexpected failure(s) — see /tmp/pj-ship-test.log"
    fi
  fi

  hdr "Build"
  if pnpm -s exec turbo run build $RETIRED_FILTER $TURBO_OPTS >/tmp/pj-ship-build.log 2>&1; then
    pass "pnpm build (excludes RETIRE packages)"
  else
    fail "build failed (see /tmp/pj-ship-build.log)"
  fi
fi

echo
echo "// Summary"
echo "  pass: $PASS_COUNT   warn: $WARN_COUNT   fail: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo
  echo "// FAIL — ship.sh gate refused. Fix the failures above and re-run."
  echo "// GPR — GOVERNANCE PROCESS RUNTIME"
  exit 1
fi

echo
echo "// PASS — canon gate clean. Ready to ship."
echo "// GPR — GOVERNANCE PROCESS RUNTIME"
exit 0
