#!/usr/bin/env npx tsx
/**
 * smoke-auth.ts — Auth integration smoke test
 *
 * Tests the full auth lifecycle against a running PuddleJumper instance:
 *   1. Login via POST /api/login (local user, not Google OAuth)
 *   2. Simulate token expiry by calling POST /api/refresh with the refresh token
 *   3. GET /api/identity  → assert role, tenants[].id are non-null
 *   4. GET /api/connectors → assert 200 (not 400 "Tenant scope unavailable")
 *
 * Usage:
 *   npx tsx scripts/smoke-auth.ts
 *
 * Environment variables (all optional, shown with defaults):
 *   BASE_URL      http://localhost:3002
 *   TEST_USERNAME admin
 *   TEST_PASSWORD (required — set this or the login step will fail)
 *
 * The test user must exist in PJ_LOGIN_USERS_JSON with a tenantId set.
 * See test/routes-auth.test.ts for an example user definition.
 */

const BASE_URL   = (process.env.BASE_URL   ?? "http://localhost:3002").replace(/\/$/, "");
const USERNAME   = process.env.TEST_USERNAME ?? "admin";
const PASSWORD   = process.env.TEST_PASSWORD ?? "";

// ── Tiny assertion helper ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? `  →  ${detail}` : ""}`);
    failed++;
  }
}

// ── Cookie jar ───────────────────────────────────────────────────────────────

const cookieJar: Record<string, string> = {};

function parseCookies(headers: Headers): void {
  // Headers.getSetCookie() is Node 18.14+; fall back to raw header iteration
  const raw: string[] = (headers as any).getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name  = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookieJar[name] = value;
  }
}

function cookieHeader(): string {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// ── Fetch wrapper ────────────────────────────────────────────────────────────

async function req(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(),
      // CSRF bypass: PJ checks X-Requested-With for same-origin API calls
      "X-Requested-With": "XMLHttpRequest",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  parseCookies(res.headers);
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, headers: res.headers };
}

// ── Steps ────────────────────────────────────────────────────────────────────

async function stepLogin(): Promise<void> {
  console.log("\n── Step 1: Login (POST /api/login) ─────────────────────────");
  if (!PASSWORD) {
    console.error("  ❌  TEST_PASSWORD env var is not set — skipping login (will fail downstream)");
    failed++;
    return;
  }

  const { status, data } = await req("POST", "/api/login", { username: USERNAME, password: PASSWORD });
  assert(`POST /api/login → 200`, status === 200, `got ${status}: ${JSON.stringify(data)}`);

  const body = data as Record<string, unknown>;
  assert(`response.ok === true`, body?.ok === true, JSON.stringify(body));
  assert(`response.user.role is present`, typeof (body?.user as any)?.role === "string");

  if (!cookieJar["jwt"] && !cookieJar["pj_sso"]) {
    console.error("  ❌  No session cookie set (expected 'jwt' or 'pj_sso')");
    failed++;
  } else {
    const cookieName = cookieJar["jwt"] ? "jwt" : "pj_sso";
    assert(`Session cookie '${cookieName}' set`, true);
  }

  if (cookieJar["pj_refresh"]) {
    assert(`Refresh cookie 'pj_refresh' set`, true);
  } else {
    console.warn("  ⚠️   No pj_refresh cookie — refresh step will be skipped");
  }
}

async function stepRefresh(): Promise<void> {
  console.log("\n── Step 2: Refresh (POST /api/refresh) ─────────────────────");
  if (!cookieJar["pj_refresh"]) {
    console.warn("  ⚠️   Skipped — no pj_refresh cookie from login");
    return;
  }

  const { status, data } = await req("POST", "/api/refresh");
  assert(`POST /api/refresh → 200`, status === 200, `got ${status}: ${JSON.stringify(data)}`);

  const body = data as Record<string, unknown>;
  // Refresh either returns { jwt } (logic-commons) or sets a new session cookie
  const hasJwtInBody    = typeof body?.jwt === "string";
  const hasNewCookie    = !!cookieJar["jwt"] || !!cookieJar["pj_sso"];
  assert(
    `New access token issued (body.jwt or updated session cookie)`,
    hasJwtInBody || hasNewCookie,
    `body: ${JSON.stringify(body)}`,
  );
}

async function stepWhoami(): Promise<void> {
  console.log("\n── Step 3: Identity (GET /api/identity) ─────────────────────");
  // Note: PuddleJumper exposes /api/identity, not /api/v1/auth/whoami
  const { status, data } = await req("GET", "/api/identity");
  assert(`GET /api/identity → 200`, status === 200, `got ${status}: ${JSON.stringify(data)}`);

  const body = data as Record<string, unknown>;
  assert(`role is non-null`, body?.role != null && body.role !== "", `role = ${JSON.stringify(body?.role)}`);

  const tenants = body?.tenants as unknown[];
  const firstTenant = (tenants?.[0] ?? {}) as Record<string, unknown>;
  assert(
    `tenants[0].id (workspaceId) is non-null`,
    typeof firstTenant?.id === "string" && firstTenant.id.length > 0,
    `tenants = ${JSON.stringify(tenants)}`,
  );

  // tenantId lives in the JWT claims, not the /identity body — confirm via the tenants array
  assert(
    `tenants array is non-empty`,
    Array.isArray(tenants) && tenants.length > 0,
    `tenants = ${JSON.stringify(tenants)}`,
  );
}

async function stepConnectors(): Promise<void> {
  console.log("\n── Step 4: Connectors (GET /api/connectors) ─────────────────");
  const { status, data } = await req("GET", "/api/connectors");

  const body = data as Record<string, unknown>;
  const isTenantError =
    status === 400 &&
    typeof body?.error === "string" &&
    body.error.toLowerCase().includes("tenant scope unavailable");

  assert(
    `GET /api/connectors → 200 (not "Tenant scope unavailable")`,
    status === 200 && !isTenantError,
    isTenantError
      ? `Got 400 "Tenant scope unavailable" — test user may be missing tenantId in PJ_LOGIN_USERS_JSON`
      : `got ${status}: ${JSON.stringify(body)}`,
  );

  if (status === 200) {
    assert(`response.tenantId is non-null`, body?.tenantId != null, `tenantId = ${JSON.stringify(body?.tenantId)}`);
    assert(`response.connectors object present`, body?.connectors != null);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🔍  PuddleJumper Auth Smoke Test`);
  console.log(`    BASE_URL : ${BASE_URL}`);
  console.log(`    USERNAME : ${USERNAME}`);
  console.log(`    PASSWORD : ${PASSWORD ? "***" : "(NOT SET)"}`);

  // Confirm server is reachable before running steps
  try {
    const { status } = await req("GET", "/api/auth/status");
    if (status >= 500) throw new Error(`/api/auth/status returned ${status}`);
    console.log(`\n    Server reachable (/api/auth/status → ${status}) ✓`);
  } catch (err) {
    console.error(`\n  ❌  Server unreachable at ${BASE_URL}  →  ${err}`);
    console.error(`      Start PuddleJumper first: cd n8drive && pnpm dev`);
    process.exit(1);
  }

  await stepLogin();
  await stepRefresh();
  await stepWhoami();
  await stepConnectors();

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${"─".repeat(55)}`);
  console.log(`  Results: ${passed}/${total} passed${failed > 0 ? `  (${failed} FAILED)` : ""}`);
  if (failed > 0) {
    console.error(`\n  ❌  Smoke test FAILED — see errors above`);
    process.exit(1);
  } else {
    console.log(`\n  ✅  Smoke test PASSED`);
  }
}

main().catch((err) => {
  console.error("\n  💥  Unexpected error:", err);
  process.exit(1);
});
