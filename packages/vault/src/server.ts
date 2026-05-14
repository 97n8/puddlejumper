import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createJwtAuthenticationMiddleware } from "./jwtAuth.js";
import { FileSystemVaultStorage } from "./fileSystemStorage.js";
import { AuditLedger } from "./auditLedger.js";
import { ManifestRegistry } from "./manifestRegistry.js";
import { VaultPolicyProvider } from "./policyProvider.js";
import { createModuleBuilderRouter } from "./moduleBuilderRoutes.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Environment configuration ────────────────────────────────────────────────
const PORT = parseInt(process.env.VAULT_PORT ?? "3003", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";
const IS_PROD = NODE_ENV === "production";
const DATA_DIR = process.env.VAULT_DATA_DIR ?? path.join(__dirname, "../data");
const DB_DIR = process.env.VAULT_DB_DIR ?? path.join(__dirname, "../data/db");
const LOG_REQUESTS = (process.env.VAULT_LOG_REQUESTS ?? (IS_PROD ? "false" : "true")).toLowerCase() === "true";

// ── CORS allowlist (validated at startup) ────────────────────────────────────
const DEFAULT_DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3002"];
const allowedOrigins = (() => {
  const fromEnv = (process.env.VAULT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (fromEnv.length > 0) return fromEnv;
  if (IS_PROD) {
    throw new Error(
      "[Vault] VAULT_ALLOWED_ORIGINS must be set in production (comma-separated origins)"
    );
  }
  return DEFAULT_DEV_ORIGINS;
})();

// ── Structured logger ────────────────────────────────────────────────────────
type LogLevel = "info" | "warn" | "error";
function log(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
  const entry = { level, scope: "vault", time: new Date().toISOString(), msg, ...extra };
  const line = JSON.stringify(entry);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

log("info", "starting", { nodeEnv: NODE_ENV, port: PORT });

// Initialize storage, audit ledger, and manifest registry
const storage = new FileSystemVaultStorage(DATA_DIR);
await storage.initialize();

const auditLedger = new AuditLedger(path.join(DB_DIR, "audit.db"));
const manifestRegistry = new ManifestRegistry(path.join(DB_DIR, "manifests.db"));

// Initialize PolicyProvider
const policyProvider = new VaultPolicyProvider(storage, auditLedger, manifestRegistry);

log("info", "subsystems_ready", {
  processes: (await storage.listProcesses({})).length,
  auditLedger: true,
  manifestRegistry: true,
});

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS (allow requests from PuddleJumper)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Request logging — opt-in (off by default in production)
if (LOG_REQUESTS) {
  app.use((req, _res, next) => {
    log("info", "request", { method: req.method, path: req.path });
    next();
  });
}

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "puddlejumper-vault",
    nodeEnv: NODE_ENV,
    now: new Date().toISOString(),
    stats: {
      processes: storage.getManifest().then((m) => m.processes.length).catch(() => 0),
      auditEvents: auditLedger.count({}),
      manifests: manifestRegistry.list({ limit: 1 }).length,
    },
  });
});

// JWT authentication middleware for protected routes
const authMiddleware = createJwtAuthenticationMiddleware();

// ── Module Builder Routes ────────────────────────────────────────────────────

app.use("/api/v1/vault/modules", authMiddleware, createModuleBuilderRouter(DB_DIR));

// ── FormKey & Process Endpoints ─────────────────────────────────────────────

/**
 * GET /api/v1/vault/formkey/:key
 * Retrieve a process package by FormKey.
 */
app.get("/api/v1/vault/formkey/:key", authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;
    const pkg = await storage.getProcessByFormKey(key);

    if (!pkg) {
      res.status(404).json({ error: "Process not found for FormKey", formKey: key });
      return;
    }

    res.json(pkg);
  } catch (err) {
    log("error", "formkey_lookup_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/vault/processes
 * List all available processes (with optional filters).
 */
app.get("/api/v1/vault/processes", authMiddleware, async (req, res) => {
  try {
    const filters = {
      category: req.query.category as string | undefined,
      jurisdiction: req.query.jurisdiction as string | undefined,
      tenantScope: req.query.tenantScope as string | undefined,
    };

    const processes = await storage.listProcesses(filters);
    res.json({ processes, count: processes.length });
  } catch (err) {
    log("error", "list_processes_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/vault/processes/:id
 * Get a specific process by ID (optional version query param).
 */
app.get("/api/v1/vault/processes/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const version = req.query.version as string | undefined;

    const pkg = await storage.getProcess(id, version);

    if (!pkg) {
      res.status(404).json({ error: "Process not found", id, version });
      return;
    }

    res.json(pkg);
  } catch (err) {
    log("error", "get_process_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/vault/search?q=<query>
 * Search processes by text query.
 */
app.get("/api/v1/vault/search", authMiddleware, async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: "Query parameter 'q' required" });
      return;
    }

    const results = await storage.searchProcesses(query.trim());
    res.json({ results, count: results.length, query });
  } catch (err) {
    log("error", "search_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/vault/manifest
 * Get the vault manifest (index of all processes).
 */
app.get("/api/v1/vault/manifest", authMiddleware, async (_req, res) => {
  try {
    const manifest = await storage.getManifest();
    res.json(manifest);
  } catch (err) {
    log("error", "manifest_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PolicyProvider HTTP Endpoints ───────────────────────────────────────────

/**
 * POST /api/v1/vault/check-authorization
 */
app.post("/api/v1/vault/check-authorization", authMiddleware, async (req, res) => {
  try {
    const result = await policyProvider.checkAuthorization(req.body);
    res.json(result);
  } catch (err) {
    log("error", "check_authorization_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/chain-template
 */
app.post("/api/v1/vault/chain-template", authMiddleware, async (req, res) => {
  try {
    const result = await policyProvider.getChainTemplate(req.body);
    res.json(result);
  } catch (err) {
    log("error", "chain_template_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/audit
 */
app.post("/api/v1/vault/audit", authMiddleware, async (req, res) => {
  try {
    await policyProvider.writeAuditEvent(req.body);
    res.json({ success: true });
  } catch (err) {
    log("error", "audit_write_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/vault/audit
 */
app.get("/api/v1/vault/audit", authMiddleware, async (req, res) => {
  try {
    const options = {
      workspaceId: req.query.workspaceId as string | undefined,
      eventType: req.query.eventType as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const events = auditLedger.read(options);
    const total = auditLedger.count({
      workspaceId: options.workspaceId,
      eventType: options.eventType,
    });

    res.json({ events, total, limit: options.limit, offset: options.offset });
  } catch (err) {
    log("error", "audit_read_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/manifests/register
 */
app.post("/api/v1/vault/manifests/register", authMiddleware, async (req, res) => {
  try {
    const result = await policyProvider.registerManifest(req.body);
    if (!result.accepted) {
      res.status(409).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    log("error", "manifest_register_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/authorize-release
 */
app.post("/api/v1/vault/authorize-release", authMiddleware, async (req, res) => {
  try {
    const result = await policyProvider.authorizeRelease(req.body);
    if (!result.authorized) {
      res.status(403).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    log("error", "authorize_release_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/classify-drift
 */
app.post("/api/v1/vault/classify-drift", authMiddleware, async (req, res) => {
  try {
    const result = await policyProvider.classifyDrift(req.body);
    res.json(result);
  } catch (err) {
    log("error", "classify_drift_failed", { detail: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Error Handler ───────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log("error", "unhandled", { detail: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

// ── Start Server ────────────────────────────────────────────────────────────

const HOST = IS_PROD ? "0.0.0.0" : "localhost";

app.listen(PORT, HOST, () => {
  log("info", "listening", { host: HOST, port: PORT });
});
