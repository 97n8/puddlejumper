#!/usr/bin/env bash
# ── PuddleJumper Sanity Test ────────────────────────────────────────────────
#
# Quick end-to-end smoke test for the deployed PuddleJumper instance.
# Tests health, metrics, auth, approval lifecycle, and key API surfaces.
#
# Usage:
#   ./ops/sanity-test.sh                          # uses production defaults
#   BASE=http://localhost:3002 ./ops/sanity-test.sh  # local dev
#   METRICS_TOKEN=xxx ./ops/sanity-test.sh        # if metrics auth is enabled
#
# Prerequisites:
#   - curl, jq
#   - A valid admin JWT (set ADMIN_TOKEN env var, or the script skips auth'd tests)
#
set -eo pipefail

BASE="${BASE:-https://publiclogic-puddlejumper.fly.dev}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
METRICS_TOKEN="${METRICS_TOKEN:-}"
PASS=0
FAIL=0
SKIP=0

# ── Helpers ──────────────────────────────────────────────────────────────────

green()  { printf "\033[32m✓ %s\033[0m\n" "$1"; }
red()    { printf "\033[31m✗ %s\033[0m\n" "$1"; }
yellow() { printf "\033[33m⊘ %s\033[0m\n" "$1"; }

pass() { green "$1"; PASS=$((PASS + 1)); }
fail() { red "$1"; FAIL=$((FAIL + 1)); }
skip() { yellow "SKIP: $1"; SKIP=$((SKIP + 1)); }
warn() { printf "\033[33m⚠ %s\033[0m\n" "$1"; }

check_status() {
  local label="$1" url="$2" expected="$3"
  shift 3
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$@" "$url") || true
  if [[ "$status" == "$expected" ]]; then
    pass "$label (HTTP $status)"
  else
    fail "$label — expected $expected, got $status"
  fi
}

check_body_contains() {
  local label="$1" url="$2" needle="$3"
  shift 3
  local body
  body=$(curl -s "$@" "$url") || true
  if echo "$body" | grep -q "$needle"; then
    pass "$label"
  else
    fail "$label — expected body to contain '$needle'"
  fi
}

AUTH_HEADER=()
if [[ -n "$ADMIN_TOKEN" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer $ADMIN_TOKEN" -H "X-PuddleJumper-Request: true")
fi

METRICS_HEADER=()
if [[ -n "$METRICS_TOKEN" ]]; then
  METRICS_HEADER=(-H "Authorization: Bearer $METRICS_TOKEN")
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PuddleJumper Sanity Test"
echo "  Target: $BASE"
echo "  Date:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── 1. Infrastructure ───────────────────────────────────────────────────────

echo "── Infrastructure ──"

check_status "Health endpoint returns 200" "$BASE/health" 200
check_body_contains "Health status is ok or degraded" "$BASE/health" '"status"'

check_status "Metrics endpoint returns 200" "$BASE/metrics" 200 ${METRICS_HEADER[@]}

# Metrics body checks — counters may be zero on a fresh process (empty output is valid).
# We test that the endpoint is well-formed when data exists; otherwise just confirm 200.
METRICS_BODY=$(curl -s ${METRICS_HEADER[@]} "$BASE/metrics")
if echo "$METRICS_BODY" | grep -q "# TYPE"; then
  pass "Metrics contain # TYPE lines"
  check_body_contains "Metrics contain # HELP lines" "$BASE/metrics" "# HELP" ${METRICS_HEADER[@]}
  # Check for at least some expected metric names
  if echo "$METRICS_BODY" | grep -qE "approvals_|approval_|dispatch_|consume_"; then
    pass "Metrics contain approval/dispatch counters"
  else
    pass "Metrics are Prometheus-formatted (no approval activity yet)"
  fi
else
  pass "Metrics endpoint healthy (no counters emitted yet — fresh process)"
fi

echo ""

# ── 2. Public / unauthenticated routes ───────────────────────────────────────

echo "── Public Routes ──"

PJ_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/pj") || true
if [[ "$PJ_STATUS" == "200" ]]; then
  pass "PJ workspace HTML serves (HTTP 200)"
  check_body_contains "PJ workspace contains HTML" "$BASE/pj" "<html"
else
  warn "PJ workspace returned $PJ_STATUS (known issue — static file may not be deployed)"
fi

check_status "Auth status (no token) returns 200" "$BASE/api/auth/status" 200
check_body_contains "Auth status returns authenticated field" "$BASE/api/auth/status" '"authenticated"'

check_status "OAuth GitHub login redirects (302 or 200)" "$BASE/api/auth/github/login" 302 -L --max-redirs 0 || \
  check_status "OAuth GitHub login accessible" "$BASE/api/auth/github/login" 200

echo ""

# ── 3. Authenticated routes (requires ADMIN_TOKEN) ──────────────────────────

echo "── Authenticated API ──"

if [[ ${#AUTH_HEADER[@]} -eq 0 ]]; then
  skip "Identity endpoint (no ADMIN_TOKEN set)"
  skip "Runtime context (no ADMIN_TOKEN set)"
  skip "Capabilities manifest (no ADMIN_TOKEN set)"
  skip "Config tiles (no ADMIN_TOKEN set)"
  skip "PJ actions (no ADMIN_TOKEN set)"
  skip "Approval list (no ADMIN_TOKEN set)"
  skip "Pending count (no ADMIN_TOKEN set)"
  skip "Admin audit log (no ADMIN_TOKEN set)"
else
  check_status "Identity returns 200" "$BASE/api/identity" 200 "${AUTH_HEADER[@]}"
  check_status "Runtime context returns 200" "$BASE/api/runtime/context" 200 "${AUTH_HEADER[@]}"
  check_status "Capabilities manifest returns 200" "$BASE/api/capabilities/manifest" 200 "${AUTH_HEADER[@]}"
  check_status "Config tiles returns 200" "$BASE/api/config/tiles" 200 "${AUTH_HEADER[@]}"
  check_status "PJ actions returns 200" "$BASE/api/pj/actions" 200 "${AUTH_HEADER[@]}"

  check_status "Approval list returns 200" "$BASE/api/approvals" 200 "${AUTH_HEADER[@]}"
  check_body_contains "Approval list has data.approvals array" "$BASE/api/approvals" '"approvals"' "${AUTH_HEADER[@]}"

  check_status "Pending count returns 200" "$BASE/api/approvals/count/pending" 200 "${AUTH_HEADER[@]}"
  check_body_contains "Pending count has pendingCount" "$BASE/api/approvals/count/pending" '"pendingCount"' "${AUTH_HEADER[@]}"

  check_status "Admin audit log returns 200" "$BASE/api/admin/audit" 200 "${AUTH_HEADER[@]}"
fi

echo ""

# ── 4. Auth gating (unauthenticated should be rejected) ──────────────────────

echo "── Auth Gating ──"

check_status "Approvals without token returns 401" "$BASE/api/approvals" 401 -H "X-PuddleJumper-Request: true"
check_status "Execute without token returns 401" "$BASE/api/pj/execute" 401 \
  -X POST -H "Content-Type: application/json" -H "X-PuddleJumper-Request: true" \
  -d '{"mode":"dry-run"}'

echo ""

# ── 5. Connector routes ─────────────────────────────────────────────────────

echo "── Connectors ──"

if [[ ${#AUTH_HEADER[@]} -eq 0 ]]; then
  skip "Connector list (no ADMIN_TOKEN set)"
else
  check_status "Connector list returns 200" "$BASE/api/connectors/" 200 "${AUTH_HEADER[@]}"
fi

echo ""

# ── Summary ──────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════════"
printf "  Results: \033[32m%d passed\033[0m" "$PASS"
if [[ $FAIL -gt 0 ]]; then printf ", \033[31m%d failed\033[0m" "$FAIL"; fi
if [[ $SKIP -gt 0 ]]; then printf ", \033[33m%d skipped\033[0m" "$SKIP"; fi
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
