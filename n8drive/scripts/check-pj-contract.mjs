#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PJ_ROOT = path.join(ROOT, "apps", "puddlejumper");
const masterHtmlPath = path.join(PJ_ROOT, "public", "puddlejumper-master-environment-control.html");
const serverPath = path.join(PJ_ROOT, "src", "api", "server.ts");
const governancePath = path.join(PJ_ROOT, "src", "api", "routes", "governance.ts");
const configPath = path.join(PJ_ROOT, "src", "api", "routes", "config.ts");

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Missing required file: ${filePath} (${error instanceof Error ? error.message : "read failed"})`);
  }
}

function findLineMatches(source, pattern) {
  const lines = source.split(/\r?\n/);
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      matches.push({ line: index + 1, value: lines[index] });
    }
    pattern.lastIndex = 0;
  }
  return matches;
}

function failWith(errors) {
  process.stderr.write("PJ contract checks failed:\n");
  errors.forEach((error) => {
    process.stderr.write(`- ${error}\n`);
  });
  process.exit(1);
}

const errors = [];
const masterHtml = readFile(masterHtmlPath);
const serverSource = readFile(serverPath);
const governanceSource = readFile(governancePath);
const configSource = readFile(configPath);

const innerHtmlMatches = findLineMatches(masterHtml, /\binnerHTML\b/);
if (innerHtmlMatches.length > 0) {
  errors.push(
    `${path.relative(ROOT, masterHtmlPath)} uses innerHTML at lines ${innerHtmlMatches
      .map((match) => String(match.line))
      .join(", ")}`
  );
}

const unsafeInlineMatches = findLineMatches(masterHtml, /unsafe-inline/i);
if (unsafeInlineMatches.length > 0) {
  errors.push(
    `${path.relative(ROOT, masterHtmlPath)} contains unsafe-inline at lines ${unsafeInlineMatches
      .map((match) => String(match.line))
      .join(", ")}`
  );
}

if (!/const\s+PJ_EXECUTE\s*=\s*["']\/api\/pj\/execute["']/.test(masterHtml)) {
  errors.push(`${path.relative(ROOT, masterHtmlPath)} must call /api/pj/execute as the authoritative execution route`);
}

if (!/const\s+ENABLE_BACKEND\s*=\s*true\s*;/.test(masterHtml)) {
  errors.push(`${path.relative(ROOT, masterHtmlPath)} must default ENABLE_BACKEND=true`);
}

if (/\bDEMO_MODE\b/.test(masterHtml)) {
  errors.push(`${path.relative(ROOT, masterHtmlPath)} must not introduce DEMO_MODE in production PJ surface`);
}

function extractInlineTagContent(source, tag) {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = source.match(pattern);
  return match && typeof match[1] === "string" ? match[1] : null;
}

function sha256Base64(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("base64");
}

const cspMatch = masterHtml.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/i);
if (!cspMatch || typeof cspMatch[1] !== "string") {
  errors.push(`${path.relative(ROOT, masterHtmlPath)} must define an inline Content-Security-Policy meta tag`);
} else {
  const csp = cspMatch[1];
  const scriptContent = extractInlineTagContent(masterHtml, "script");
  const styleContent = extractInlineTagContent(masterHtml, "style");
  if (!scriptContent || !styleContent) {
    errors.push(`${path.relative(ROOT, masterHtmlPath)} must include both inline <style> and <script> blocks for hash verification`);
  } else {
    const scriptHash = sha256Base64(scriptContent);
    const styleHash = sha256Base64(styleContent);
    if (!csp.includes(`script-src 'sha256-${scriptHash}'`)) {
      errors.push(`${path.relative(ROOT, masterHtmlPath)} CSP script hash is stale (expected sha256-${scriptHash})`);
    }
    if (!csp.includes(`style-src 'sha256-${styleHash}'`)) {
      errors.push(`${path.relative(ROOT, masterHtmlPath)} CSP style hash is stale (expected sha256-${styleHash})`);
    }
  }
}

// Check for /api/pj/actions in server.ts OR router.get("/pj/actions" in config.ts
const hasActionsRoute = 
  /app\.get\(\s*["']\/api\/pj\/actions["']/.test(serverSource) ||
  /router\.get\(\s*["']\/pj\/actions["']/.test(configSource);

if (!hasActionsRoute) {
  errors.push(`Must expose GET /api/pj/actions (check ${path.relative(ROOT, serverPath)} or ${path.relative(ROOT, configPath)})`);
}

// Check for /api/pj/execute in server.ts OR router.post("/pj/execute" in governance.ts
const hasExecuteRoute = 
  /app\.post\(\s*["']\/api\/pj\/execute["']/.test(serverSource) ||
  /router\.post\(\s*["']\/pj\/execute["']/.test(governanceSource);

if (!hasExecuteRoute) {
  errors.push(`Must expose POST /api/pj/execute (check ${path.relative(ROOT, serverPath)} or ${path.relative(ROOT, governancePath)})`);
}

if (errors.length > 0) {
  failWith(errors);
}

process.stdout.write("PJ contract checks passed.\n");
