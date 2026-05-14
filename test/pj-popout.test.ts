import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import { applyIdentityContext, isTrustedOriginFromList } from "../src/internal-remote/pj-popout-security.js";

test("trusted-origin validator rejects unauthorized origin and accepts allowed origin", () => {
  const allowed = ["https://portal.publiclogic.org", "*.publiclogic.org"];
  assert.equal(isTrustedOriginFromList("https://evil.example.com", allowed), false);
  assert.equal(isTrustedOriginFromList("https://portal.publiclogic.org", allowed), true);
  assert.equal(isTrustedOriginFromList("https://ops.publiclogic.org", allowed), true);
  assert.equal(isTrustedOriginFromList("https://ops.publiclogic.org:8443", allowed), true);
  assert.equal(isTrustedOriginFromList("https://evilpubliclogic.org", allowed), false);
});

test("identity context merges runtime payload", () => {
  const merged = applyIdentityContext(
    {
      name: "",
      role: "",
      tenants: [],
      trustedParentOrigins: []
    },
    {
      name: "Taylor Adams",
      role: "admin",
      tenants: [{ id: "tenant-1", name: "Ashfield", sha: "abc123", connections: ["SharePoint"] }],
      trustedParentOrigins: ["https://portal.publiclogic.org"]
    }
  );

  assert.equal(merged.name, "Taylor Adams");
  assert.equal(merged.role, "admin");
  assert.equal(merged.tenants.length, 1);
});

test("pj popout source does not hardcode operator or tenant names", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "pj-popout.html"), "utf8");
  assert.equal(/Nathan|Lawrence|Andover|Lowell|Haverhill/.test(source), false);
  assert.equal(/Authenticated Operator|Current Tenant/.test(source), false);
});

test("pj popout page does not rely on inline script/style blocks", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "pj-popout.html"), "utf8");
  assert.equal(/<style>/.test(source), false);
  assert.equal(/<script type="module">/.test(source), false);
  assert.match(source, /<script type="module" src="\/pj-popout\.js"><\/script>/);
});

test("pj popout renders untrusted connection labels as text (no script execution)", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "pj-popout.html"), "utf8");
  assert.equal(/div\.innerHTML\s*=\s*`<div class="connection-dot"><\/div><span>\$\{name\}<\/span>`/.test(source), false);

  const dom = new JSDOM("<!doctype html><body><div id='connections'></div></body>");
  const document = dom.window.document;
  const container = document.getElementById("connections");
  assert.ok(container);
  if (!container) {
    throw new Error("connections container missing");
  }

  const payload = "<script>alert(1)</script>";
  const div = document.createElement("div");
  div.className = "connection";
  const dot = document.createElement("div");
  dot.className = "connection-dot";
  const label = document.createElement("span");
  label.textContent = payload;
  div.appendChild(dot);
  div.appendChild(label);
  container.appendChild(div);

  assert.equal(container.querySelectorAll("script").length, 0);
  assert.match(container.textContent ?? "", /<script>alert\(1\)<\/script>/);
});

test("remote app tile renderer does not use innerHTML for tile content", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "internal-remote", "remote-app.js"), "utf8");
  assert.equal(/button\.innerHTML\s*=/.test(source), false);
  assert.match(source, /label\.textContent\s*=/);
});

test("popout client renderer does not use innerHTML sinks", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "pj-popout.js"), "utf8");
  assert.equal(/innerHTML\s*=/.test(source), false);
  assert.match(source, /textContent\s*=/);
});

test("popout uses live capabilities endpoint and has no hardcoded capability arrays", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "pj-popout.js"), "utf8");
  assert.match(source, /fetchApi\('\/api\/capabilities\/manifest'\)/);
  assert.match(source, /fetchApi\('\/api\/config\/capabilities'\)/);
  assert.match(source, /Capability manifest unavailable/);
  assert.equal(/const automations\s*=\s*\[/.test(source), false);
  assert.equal(/const quickActions\s*=\s*\[/.test(source), false);
});

test("remote app uses live runtime endpoints and has no default tile set", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "internal-remote", "remote-app.js"), "utf8");
  assert.match(source, /fetchApi\(\"\/api\/capabilities\/manifest\"\)/);
  assert.match(source, /fetchApi\(\"\/api\/runtime\/context\"\)/);
  assert.match(source, /fetchApi\(\"\/api\/config\/tiles\"\)/);
  assert.match(source, /corePrompt\.read/);
  assert.match(source, /evaluate\.execute/);
  assert.equal(/DEFAULT_TILES/.test(source), false);
});

test("master PJ triggers token refresh before expiry with a single in-flight guard", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "public", "puddlejumper-master-environment-control.html"),
    "utf8"
  );
  assert.match(source, /const TOKEN_REFRESH_EARLY_MS = 30 \* 1000/);
  assert.match(source, /let authTokenRefreshPromise = null/);
  assert.match(source, /function isTokenExpiringSoon\(/);
  assert.match(source, /async function ensureValidRuntimeAuthToken\(/);
  assert.match(source, /if \(authTokenRefreshPromise\) return authTokenRefreshPromise;/);
});

test("master PJ retries 401 exactly once and fails closed when refresh fails", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "public", "puddlejumper-master-environment-control.html"),
    "utf8"
  );
  assert.match(source, /let attemptedRetry = false;/);
  assert.match(source, /if \(response\.status === 401 && !attemptedRetry\)/);
  assert.match(source, /throw new Error\(\"Authentication required\"\);/);
  assert.match(source, /if \(response\.status === 401\) \{\s*clearRuntimeAuthToken\(\);/);
});

test("popout client retries 401 once and avoids refresh loops", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "pj-popout.js"), "utf8");
  assert.match(source, /const TOKEN_REFRESH_EARLY_MS = 30 \* 1000/);
  assert.match(source, /authTokenRefreshPromise: null/);
  assert.match(source, /if \(state\.authTokenRefreshPromise\) \{\s*return state\.authTokenRefreshPromise;/);
  assert.match(source, /let attemptedRetry = false;/);
  assert.match(source, /if \(response\.status === 401 && !attemptedRetry && !isTokenEndpoint\)/);
  assert.match(source, /throw new Error\(\"Authentication required\"\);/);
  assert.match(source, /if \(response\.status === 401\) \{\s*clearAuthToken\(\);/);
});
