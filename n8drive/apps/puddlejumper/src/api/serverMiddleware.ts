// ── Express middleware: security headers, CORS, correlation ID, logging ─────
import crypto from "node:crypto";
import fs from "node:fs";
import express from "express";
import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_PATTERN,
  parseCsv,
} from "./config.js";

// ── Trusted origin helpers ──────────────────────────────────────────────────

export function normalizeTrustedOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function resolveTrustedParentOrigins(nodeEnv: string): string[] {
  const configured = parseCsv(process.env.PJ_ALLOWED_PARENT_ORIGINS)
    .map((v) => normalizeTrustedOrigin(v))
    .filter((v): v is string => Boolean(v));

  const defaults =
    nodeEnv === "production"
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"];

  const normalizedDefaults = defaults
    .map((v) => normalizeTrustedOrigin(v))
    .filter((v): v is string => Boolean(v));

  return Array.from(new Set([...configured, ...normalizedDefaults]));
}

export function resolveCorsAllowedOrigins(nodeEnv: string): string[] {
  const configured = parseCsv(process.env.CORS_ALLOWED_ORIGINS)
    .map((v) => normalizeTrustedOrigin(v))
    .filter((v): v is string => Boolean(v));

  const defaults =
    nodeEnv === "production"
      ? []
      : [
          "http://localhost:3000", "https://localhost:3000",
          "http://127.0.0.1:3000", "https://127.0.0.1:3000",
          "http://localhost:3002", "https://localhost:3002",
          "http://127.0.0.1:3002", "https://127.0.0.1:3002",
        ];

  const normalizedDefaults = defaults
    .map((v) => normalizeTrustedOrigin(v))
    .filter((v): v is string => Boolean(v));

  const trustedParentOrigins = resolveTrustedParentOrigins(nodeEnv);
  return Array.from(new Set([...configured, ...normalizedDefaults, ...trustedParentOrigins]));
}

// ── CSP / inline hash computation ───────────────────────────────────────────

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function buildConnectSrcDirective(trustedParentOrigins: string[], includeParentOrigins: boolean): string {
  if (!includeParentOrigins || trustedParentOrigins.length === 0) return "connect-src 'self'";
  const sources = Array.from(new Set(["'self'", ...trustedParentOrigins]));
  return `connect-src ${sources.join(" ")}`;
}

function extractInlineTagContent(source: string, tag: "script" | "style"): string | null {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = source.match(pattern);
  if (!match || typeof match[1] !== "string") return null;
  return match[1];
}

export function resolvePjInlineCspHashes(pjWorkspaceFile: string): { scriptHash: string | null; styleHash: string | null } {
  try {
    const source = fs.readFileSync(pjWorkspaceFile, "utf8");
    const scriptContent = extractInlineTagContent(source, "script");
    const styleContent = extractInlineTagContent(source, "style");
    const scriptHash = scriptContent ? crypto.createHash("sha256").update(scriptContent, "utf8").digest("base64") : null;
    const styleHash = styleContent ? crypto.createHash("sha256").update(styleContent, "utf8").digest("base64") : null;
    return { scriptHash, styleHash };
  } catch {
    return { scriptHash: null, styleHash: null };
  }
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderPjWorkspaceHtml(pjWorkspaceFile: string, trustedParentOrigins: string[]): string {
  let source = fs.readFileSync(pjWorkspaceFile, "utf8");
  const inlineHashes = resolvePjInlineCspHashes(pjWorkspaceFile);
  if (inlineHashes.styleHash && inlineHashes.scriptHash) {
    const connectSrcDirective = buildConnectSrcDirective(trustedParentOrigins, true);
    const inlineMetaCsp = [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "form-action 'self'",
      connectSrcDirective,
      "img-src 'self' data:",
      "font-src 'self'",
      `style-src 'sha256-${inlineHashes.styleHash}'`,
      `script-src 'sha256-${inlineHashes.scriptHash}'`,
    ].join("; ");
    source = source.replace(
      /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
      `<meta http-equiv="Content-Security-Policy" content="${inlineMetaCsp}">`,
    );
  }
  const trustedValue = escapeHtmlAttribute(trustedParentOrigins.join(","));
  const marker = '<meta name="pj-trusted-parent-origins" content="">';
  if (!source.includes(marker)) return source;
  return source.replace(marker, `<meta name="pj-trusted-parent-origins" content="${trustedValue}">`);
}

// ── Security headers middleware ─────────────────────────────────────────────

export function createSecurityHeadersMiddleware(nodeEnv: string, pjWorkspaceFile: string) {
  const trustedParentOrigins = resolveTrustedParentOrigins(nodeEnv);
  const frameAncestors = ["'self'", ...trustedParentOrigins].join(" ");
  const allowCrossOriginEmbedding = trustedParentOrigins.length > 0;
  const inlinePjPaths = new Set(["/pj", "/puddle-jumper", "/pj-workspace", "/puddlejumper-master-environment-control.html"]);
  const trustedConnectPaths = new Set([
    "/pj", "/puddle-jumper", "/pj-workspace",
    "/puddlejumper-master-environment-control.html", "/pj-popout.html",
  ]);

  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (allowCrossOriginEmbedding) {
      res.removeHeader("X-Frame-Options");
    } else {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
    }

    const normalizedPath = normalizePathname(req.path);
    const allowsInlineAssets = inlinePjPaths.has(normalizedPath);
    const allowsParentApiConnect = trustedConnectPaths.has(normalizedPath);
    const inlineHashes = allowsInlineAssets ? resolvePjInlineCspHashes(pjWorkspaceFile) : { scriptHash: null, styleHash: null };
    const scriptSrc = allowsInlineAssets && inlineHashes.scriptHash
      ? `script-src 'self' 'sha256-${inlineHashes.scriptHash}'`
      : "script-src 'self'";
    const styleSrc = allowsInlineAssets && inlineHashes.styleHash
      ? `style-src 'self' 'sha256-${inlineHashes.styleHash}'`
      : "style-src 'self' https://fonts.googleapis.com";

    const connectSrc = buildConnectSrcDirective(trustedParentOrigins, allowsParentApiConnect);

    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'", scriptSrc, styleSrc,
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:", connectSrc,
        "object-src 'none'", "base-uri 'none'",
        `frame-ancestors ${frameAncestors}`,
      ].join("; "),
    );
    next();
  };
}

// ── CORS middleware ─────────────────────────────────────────────────────────

export function createCorsMiddleware(nodeEnv: string) {
  const allowedOrigins = new Set(resolveCorsAllowedOrigins(nodeEnv));
  const defaultAllowHeaders = [
    "Authorization", "Content-Type", "X-MS-Graph-Token",
    "X-PuddleJumper-Request", "X-Correlation-Id",
  ].join(", ");
  const allowMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const originHeader = req.get("Origin");
    const normalizedOrigin = originHeader ? normalizeTrustedOrigin(originHeader) : null;
    const isAllowedOrigin = normalizedOrigin ? allowedOrigins.has(normalizedOrigin) : false;

    if (isAllowedOrigin && normalizedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
      res.append("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", allowMethods);
      const requestedHeaders = req.get("Access-Control-Request-Headers");
      res.setHeader("Access-Control-Allow-Headers", requestedHeaders ?? defaultAllowHeaders);
      res.setHeader("Access-Control-Max-Age", "600");
    }

    if (req.method === "OPTIONS" && originHeader) {
      if (!isAllowedOrigin) {
        res.status(403).json({ error: "CORS origin denied" });
        return;
      }
      res.status(200).end();
      return;
    }

    next();
  };
}

// ── Correlation ID middleware ────────────────────────────────────────────────

function normalizeCorrelationId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!CORRELATION_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function withCorrelationId(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const incoming = normalizeCorrelationId(req.get(CORRELATION_ID_HEADER));
  const correlationId = incoming ?? crypto.randomUUID();
  res.locals.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);
  next();
}

export function getCorrelationId(res: express.Response): string {
  const fromLocals = typeof res.locals?.correlationId === "string" ? res.locals.correlationId : "";
  return fromLocals || crypto.randomUUID();
}

// ── Structured logging ──────────────────────────────────────────────────────

export function logServerError(scope: string, correlationId: string, error: unknown): void {
  const serialized = {
    level: "error",
    scope,
    correlationId,
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unhandled server error",
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(serialized));
}

export function logServerInfo(scope: string, correlationId: string, details: Record<string, unknown>): void {
  const serialized = {
    level: "info",
    scope,
    correlationId,
    timestamp: new Date().toISOString(),
    ...details,
  };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(serialized));
}

// ── Misc helpers ────────────────────────────────────────────────────────────

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function summarizePrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 300 ? `${normalized.slice(0, 300)}…` : normalized;
}
