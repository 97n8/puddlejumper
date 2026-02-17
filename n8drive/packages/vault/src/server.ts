import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createJwtAuthenticationMiddleware } from "@publiclogic/core";
import { FileSystemVaultStorage } from "./fileSystemStorage.js";
import { AuditLedger } from "./auditLedger.js";
import { ManifestRegistry } from "./manifestRegistry.js";
import { VaultPolicyProvider } from "./policyProvider.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration
const PORT = parseInt(process.env.VAULT_PORT ?? "3003", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";
const DATA_DIR = process.env.VAULT_DATA_DIR ?? path.join(__dirname, "../data");
const DB_DIR = process.env.VAULT_DB_DIR ?? path.join(__dirname, "../data/db");

console.log(`[Vault] Starting in ${NODE_ENV} mode`);
console.log(`[Vault] Data directory: ${DATA_DIR}`);
console.log(`[Vault] Database directory: ${DB_DIR}`);

// Initialize storage, audit ledger, and manifest registry
const storage = new FileSystemVaultStorage(DATA_DIR);
await storage.initialize();

const auditLedger = new AuditLedger(path.join(DB_DIR, "audit.db"));
const manifestRegistry = new ManifestRegistry(path.join(DB_DIR, "manifests.db"));

// Initialize PolicyProvider
const policyProvider = new VaultPolicyProvider(storage, auditLedger, manifestRegistry);

console.log(`[Vault] Storage initialized with ${(await storage.listProcesses({})).length} processes`);
console.log(`[Vault] Audit ledger ready`);
console.log(`[Vault] Manifest registry ready`);

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS (allow requests from PuddleJumper)
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3002",
    "https://pj.publiclogic.org",
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
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

// Request logging
app.use((req, _res, next) => {
  console.log(`[Vault] ${req.method} ${req.path}`);
  next();
});

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "puddlejumper-vault",
    nodeEnv: NODE_ENV,
    now: new Date().toISOString(),
    stats: {
      processes: storage.getManifest().then(m => m.processes.length).catch(() => 0),
      auditEvents: auditLedger.count({}),
      manifests: manifestRegistry.list({ limit: 1 }).length,
    },
  });
});

// JWT authentication middleware for protected routes
const authMiddleware = createJwtAuthenticationMiddleware();

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
    console.error("[Vault] Error retrieving FormKey:", err);
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
    console.error("[Vault] Error listing processes:", err);
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
    console.error("[Vault] Error retrieving process:", err);
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
    console.error("[Vault] Error searching processes:", err);
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
    console.error("[Vault] Error retrieving manifest:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PolicyProvider HTTP Endpoints ───────────────────────────────────────────

/**
 * POST /api/v1/vault/check-authorization
 * Check if operator is authorized for action.
 */
app.post("/api/v1/vault/check-authorization", authMiddleware, async (req, res) => {
  try {
    const query = req.body;
    const result = await policyProvider.checkAuthorization(query);
    res.json(result);
  } catch (err) {
    console.error("[Vault] Error checking authorization:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/chain-template
 * Get approval chain template for process/action.
 */
app.post("/api/v1/vault/chain-template", authMiddleware, async (req, res) => {
  try {
    const query = req.body;
    const result = await policyProvider.getChainTemplate(query);
    res.json(result);
  } catch (err) {
    console.error("[Vault] Error fetching chain template:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/audit
 * Write audit event (idempotent by eventId).
 */
app.post("/api/v1/vault/audit", authMiddleware, async (req, res) => {
  try {
    const event = req.body;
    await policyProvider.writeAuditEvent(event);
    res.json({ success: true });
  } catch (err) {
    console.error("[Vault] Error writing audit event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/vault/audit
 * Read audit events (paginated).
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
    console.error("[Vault] Error reading audit events:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/manifests/register
 * Register manifest (preflight validation).
 */
app.post("/api/v1/vault/manifests/register", authMiddleware, async (req, res) => {
  try {
    const input = req.body;
    const result = await policyProvider.registerManifest(input);
    
    if (!result.accepted) {
      res.status(409).json(result);
      return;
    }
    
    res.json(result);
  } catch (err) {
    console.error("[Vault] Error registering manifest:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/authorize-release
 * Authorize release (post-approval gate).
 */
app.post("/api/v1/vault/authorize-release", authMiddleware, async (req, res) => {
  try {
    const query = req.body;
    const result = await policyProvider.authorizeRelease(query);
    
    if (!result.authorized) {
      res.status(403).json(result);
      return;
    }
    
    res.json(result);
  } catch (err) {
    console.error("[Vault] Error authorizing release:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/vault/classify-drift
 * Classify drift between approved and deployed artifacts.
 */
app.post("/api/v1/vault/classify-drift", authMiddleware, async (req, res) => {
  try {
    const query = req.body;
    const result = await policyProvider.classifyDrift(query);
    res.json(result);
  } catch (err) {
    console.error("[Vault] Error classifying drift:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Error Handler ───────────────────────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Vault] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Vault] HTTP server listening on port ${PORT}`);
  console.log(`[Vault] Health check: http://localhost:${PORT}/health`);
});
