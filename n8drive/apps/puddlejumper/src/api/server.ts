// ── PuddleJumper API server (orchestrator) ──────────────────────────────────
//
// This file wires together modules extracted from the original monolithic
// server.ts.  Each domain area lives in its own file:
//
//   types.ts              – shared type definitions
//   config.ts             – env parsing, runtime resolution, constants
//   serverMiddleware.ts   – CORS, CSP, correlation-id, logging
//   msGraph.ts            – MS Graph identity exchange
//   capabilities.ts       – manifest, actions, tenant-scope, evaluate builders
//   accessNotificationWorker.ts – webhook notification queue processor
//   routes/auth.ts        – login / logout / identity
//   routes/config.ts      – runtime context, tiles, capabilities, manifest
//   routes/prr.ts         – PRR intake, list, status, close
//   routes/access.ts      – access-request intake, status, close
//   routes/governance.ts  – PJ execute, identity-token, prompt, evaluate
//
import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import cookieParser from "cookie-parser";
import {
  type AuthOptions,
  createOptionalJwtAuthenticationMiddleware,
  createJwtAuthenticationMiddleware,
  csrfProtection,
  getAuthContext,
  resolveAuthOptions,
} from "@publiclogic/core";
import authCallback from "./authCallback.js";
import { createRateLimit } from "./rateLimit.js";
import type { CanonicalSourceOptions } from "./canonicalSource.js";
import { PrrStore } from "./prrStore.js";
import { ConnectorStore } from "./connectorStore.js";
import { createPublicPrrRouter } from "./publicPrrRouter.js";
import { createConnectorsRouter } from "./connectors.js";
import {
  LOGIN_WINDOW_MS,
  LOGIN_MAX_ATTEMPTS,
  DEFAULT_ACCESS_NOTIFICATION_INTERVAL_MS,
  DEFAULT_ACCESS_NOTIFICATION_BATCH_SIZE,
  DEFAULT_ACCESS_NOTIFICATION_MAX_RETRIES,
  parseEnvPositiveInt,
  isBuiltInLoginEnabled,
  resolveLoginUsers,
  resolveRuntimeContext,
  resolveLiveTiles,
  resolveLiveCapabilities,
  assertProductionInvariants,
  isPathInsideDirectory,
} from "./config.js";
import {
  withCorrelationId,
  createCorsMiddleware,
  createSecurityHeadersMiddleware,
  resolveTrustedParentOrigins,
  renderPjWorkspaceHtml,
  getCorrelationId,
  logServerError,
  logServerInfo,
} from "./serverMiddleware.js";
import { processAccessNotificationQueueOnce } from "./accessNotificationWorker.js";
import { OAuthStateStore } from "@publiclogic/logic-commons";
import {
  createOAuthRoutes,
  googleProvider,
  githubProvider,
  microsoftProvider,
  configureRefreshStore,
  configureAuditStore,
  createSessionRoutes,
  type UserInfo,
} from "@publiclogic/logic-commons";

// Route modules
import { createAuthRoutes } from "./routes/auth.js";
import { upsertUser } from "./userStore.js";
import { createConfigRoutes } from "./routes/config.js";
import { createPrrRoutes } from "./routes/prr.js";
import { createAccessRoutes } from "./routes/access.js";
import { createGovernanceRoutes } from "./routes/governance.js";
import { createApprovalRoutes } from "./routes/approvals.js";
import { createChainTemplateRoutes } from "./routes/chainTemplates.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createWebhookActionRoutes } from "./routes/webhookAction.js";
import { createWorkspaceUsageRoutes } from "./routes/workspaceUsage.js";
import { ApprovalStore } from "../engine/approvalStore.js";
import { ChainStore } from "../engine/chainStore.js";
import { LocalPolicyProvider } from "../engine/policyProvider.js";
import { DispatcherRegistry } from "../engine/dispatch.js";
import { GitHubDispatcher } from "../engine/dispatchers/github.js";
import { SlackDispatcher } from "../engine/dispatchers/slack.js";
import { WebhookDispatcher } from "../engine/dispatchers/webhook.js";
import { SharePointDispatcher } from "../engine/dispatchers/sharepoint.js";
import { approvalMetrics, METRIC, METRIC_HELP } from "../engine/approvalMetrics.js";
import { loadConfig, StartupConfigError } from "./startupConfig.js";
import { ensurePersonalWorkspace } from "../engine/workspaceStore.js";

// ── Directory layout ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "../../");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const INTERNAL_SRC_DIR = path.join(ROOT_DIR, "src", "internal-remote");
const CONTROLLED_DATA_DIR = path.join(ROOT_DIR, "data");
const PJ_WORKSPACE_FILE = path.join(PUBLIC_DIR, "puddlejumper-master-environment-control.html");
const DEFAULT_PRR_DB_PATH = path.join(CONTROLLED_DATA_DIR, "prr.db");
const DEFAULT_CONNECTOR_DB_PATH = path.join(CONTROLLED_DATA_DIR, "connectors.db");
const DEFAULT_APPROVAL_DB_PATH = path.join(CONTROLLED_DATA_DIR, "approvals.db");

// ── App factory options ─────────────────────────────────────────────────────
type CreateAppOptions = {
  authOptions?: Partial<AuthOptions>;
  canonicalSourceOptions?: Partial<CanonicalSourceOptions>;
  msGraphFetchImpl?: typeof fetch;
  accessNotificationWorker?: {
    fetchImpl?: typeof fetch;
    intervalMs?: number;
    batchSize?: number;
    maxRetries?: number;
    disable?: boolean;
  };
};

// ── createApp ───────────────────────────────────────────────────────────────
export function createApp(nodeEnv: string = process.env.NODE_ENV ?? "development", options: CreateAppOptions = {}): express.Express {
  const authOptions = resolveAuthOptions(options.authOptions);
  assertProductionInvariants(nodeEnv, authOptions, CONTROLLED_DATA_DIR);

  // Configure logic-commons stores to use PJ's controlled data directory
  configureRefreshStore(CONTROLLED_DATA_DIR);
  configureAuditStore(CONTROLLED_DATA_DIR);

  // ── Stores ────────────────────────────────────────────────────────────
  const prrDbPath = path.resolve(process.env.PRR_DB_PATH ?? DEFAULT_PRR_DB_PATH);
  const connectorDbPath = path.resolve(process.env.CONNECTOR_DB_PATH ?? DEFAULT_CONNECTOR_DB_PATH);
  const connectorStateSecret =
    (process.env.CONNECTOR_STATE_SECRET ?? "").trim() ||
    (nodeEnv === "production" ? "" : "dev-connector-state-secret");
  if (!isPathInsideDirectory(prrDbPath, CONTROLLED_DATA_DIR)) {
    throw new Error("PRR_DB_PATH must be inside the controlled data directory");
  }
  if (!isPathInsideDirectory(connectorDbPath, CONTROLLED_DATA_DIR)) {
    throw new Error("CONNECTOR_DB_PATH must be inside the controlled data directory");
  }
  if (!connectorStateSecret) throw new Error("CONNECTOR_STATE_SECRET is required");
  const prrStore = new PrrStore(prrDbPath);
  const connectorStore = new ConnectorStore(connectorDbPath);
  const oauthStateDbPath = path.join(CONTROLLED_DATA_DIR, "oauth_state.db");
  const oauthStateStore = new OAuthStateStore(oauthStateDbPath);
  const approvalDbPath = path.resolve(process.env.APPROVAL_DB_PATH ?? DEFAULT_APPROVAL_DB_PATH);
  if (!isPathInsideDirectory(approvalDbPath, CONTROLLED_DATA_DIR)) {
    throw new Error("APPROVAL_DB_PATH must be inside the controlled data directory");
  }
  const approvalStore = new ApprovalStore(approvalDbPath);
  const chainStore = new ChainStore(approvalStore.db);
  const policyProvider = new LocalPolicyProvider(approvalStore.db, chainStore);
  const dispatcherRegistry = new DispatcherRegistry();
  const defaultRetryPolicy = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    onRetry: (attempt: number, error: string, stepId: string) => {
      approvalMetrics.increment(METRIC.DISPATCH_RETRY);
      logServerInfo("dispatch.retry", crypto.randomUUID(), { stepId, attempt, error });
    },
  };
  dispatcherRegistry.register(new GitHubDispatcher(), defaultRetryPolicy);
  dispatcherRegistry.register(new SlackDispatcher());
  dispatcherRegistry.register(new WebhookDispatcher(), defaultRetryPolicy);
  dispatcherRegistry.register(new SharePointDispatcher(), defaultRetryPolicy);

  // ── Auth middleware ───────────────────────────────────────────────────
  const authMiddleware = createJwtAuthenticationMiddleware(authOptions);
  const optionalAuthMiddleware = createOptionalJwtAuthenticationMiddleware(authOptions);

  // ── Runtime config ────────────────────────────────────────────────────
  const runtimeContext = resolveRuntimeContext(nodeEnv);
  const runtimeTiles = resolveLiveTiles(nodeEnv);
  const runtimeCapabilities = resolveLiveCapabilities(nodeEnv);
  const trustedParentOrigins = resolveTrustedParentOrigins(nodeEnv);
  const msGraphFetchImpl = options.msGraphFetchImpl ?? fetch;
  const msGraphTokenExchangeEnabled =
    process.env.ALLOW_PJ_GRAPH_TOKEN_EXCHANGE === "true" || nodeEnv !== "production";
  const loginUsers = resolveLoginUsers();
  const builtInLoginEnabled = isBuiltInLoginEnabled(nodeEnv);

  // ── Access notification worker config ─────────────────────────────────
  const accessNotificationWebhookUrl = (process.env.ACCESS_NOTIFICATION_WEBHOOK_URL ?? "").trim();
  const accessNotificationWorkerIntervalMs = Math.max(5_000,
    options.accessNotificationWorker?.intervalMs ??
    parseEnvPositiveInt(process.env.ACCESS_NOTIFICATION_WORKER_INTERVAL_MS) ??
    DEFAULT_ACCESS_NOTIFICATION_INTERVAL_MS);
  const accessNotificationBatchSize = Math.max(1, Math.min(100,
    options.accessNotificationWorker?.batchSize ??
    parseEnvPositiveInt(process.env.ACCESS_NOTIFICATION_WORKER_BATCH_SIZE) ??
    DEFAULT_ACCESS_NOTIFICATION_BATCH_SIZE));
  const accessNotificationMaxRetries = Math.max(1, Math.min(50,
    options.accessNotificationWorker?.maxRetries ??
    parseEnvPositiveInt(process.env.ACCESS_NOTIFICATION_WORKER_MAX_RETRIES) ??
    DEFAULT_ACCESS_NOTIFICATION_MAX_RETRIES));

  // ── Rate limiters ─────────────────────────────────────────────────────
  const loginRateLimit = createRateLimit({
    windowMs: LOGIN_WINDOW_MS, max: LOGIN_MAX_ATTEMPTS,
    keyGenerator: (req) => {
      const username =
        req.body && typeof req.body === "object" && "username" in req.body && typeof req.body.username === "string"
          ? req.body.username.trim().toLowerCase() : "anonymous";
      return `tenant:public:user:${username.slice(0, 64)}:route:/api/login:ip:${req.ip}`;
    },
  });
  const promptRateLimit = createRateLimit({
    windowMs: 60_000, max: 20,
    keyGenerator: (req) => {
      const auth = getAuthContext(req);
      return `tenant:${auth?.tenantId ?? "no-tenant"}:user:${auth?.userId ?? "anonymous"}:route:/api/prompt`;
    },
  });
  const evaluateRateLimit = createRateLimit({
    windowMs: 60_000, max: 60,
    keyGenerator: (req) => {
      const auth = getAuthContext(req);
      return `tenant:${auth?.tenantId ?? "no-tenant"}:user:${auth?.userId ?? "anonymous"}:route:/api/evaluate`;
    },
  });
  const pjExecuteRateLimit = createRateLimit({
    windowMs: 60_000, max: 60,
    keyGenerator: (req) => {
      const auth = getAuthContext(req);
      return `tenant:${auth?.tenantId ?? "no-tenant"}:user:${auth?.userId ?? "anonymous"}:route:/api/pj/execute`;
    },
  });
  const oauthLoginRateLimit = createRateLimit({
    windowMs: 60_000, max: 10,
    keyGenerator: (req) => `oauth-login:ip:${req.ip}`,
  });

  // ── Express app ───────────────────────────────────────────────────────
  const app = express();

  // Global middleware (must come before routes for CORS to apply)
  app.use(withCorrelationId);
  app.use(createCorsMiddleware(nodeEnv));

  // Pre-auth routes
  app.get("/health", (_req, res) => {
    const checks: Record<string, { status: string; detail?: string }> = {};

    // Database connectivity
    for (const [label, store] of [["prr", prrStore], ["connectors", connectorStore]] as const) {
      try {
        (store as any).db.prepare("SELECT 1").get();
        checks[label] = { status: "ok" };
      } catch (err: unknown) {
        checks[label] = { status: "error", detail: err instanceof Error ? err.message : String(err) };
      }
    }

    // Critical secrets presence (never leak values)
    const secretKeys = [
      "JWT_SECRET",
      "CONNECTOR_STATE_SECRET",
      "GITHUB_CLIENT_ID",
      "GOOGLE_CLIENT_ID",
      "MICROSOFT_CLIENT_ID",
    ];
    const secrets: Record<string, boolean> = {};
    for (const key of secretKeys) {
      secrets[key] = Boolean(process.env[key]?.trim());
    }
    checks.secrets = { status: Object.values(secrets).every(Boolean) ? "ok" : "warn" };

    const overall = Object.values(checks).every((c) => c.status === "ok") ? "ok" : "degraded";

    res.json({
      status: overall,
      service: "puddle-jumper-deploy-remote",
      nodeEnv,
      now: new Date().toISOString(),
      checks,
      secrets,
    });
  });
  app.get("/metrics", (req, res) => {
    // Optional bearer-token auth: set METRICS_TOKEN env to restrict scraping
    const metricsToken = process.env.METRICS_TOKEN;
    if (metricsToken) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${metricsToken}`) {
        res.status(401).json({ error: "Invalid or missing metrics token" });
        return;
      }
    }
    res.type("text/plain; version=0.0.4; charset=utf-8").send(approvalMetrics.prometheus(METRIC_HELP));
  });
  app.get("/auth/callback", authCallback);
  app.use(createSecurityHeadersMiddleware(nodeEnv, PJ_WORKSPACE_FILE));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(express.static(PUBLIC_DIR));
  app.use("/internal-src", express.static(INTERNAL_SRC_DIR));

  // Public PRR router (no auth required)
  app.use("/api/public", createPublicPrrRouter(prrStore));

  // ── Access notification background worker ─────────────────────────────
  const accessNotificationWorkerDisabled = options.accessNotificationWorker?.disable === true;
  const accessNotificationFetchImpl = options.accessNotificationWorker?.fetchImpl ?? fetch;
  if (!accessNotificationWorkerDisabled && accessNotificationWebhookUrl) {
    const runWorker = async (): Promise<void> => {
      try {
        await processAccessNotificationQueueOnce({
          prrStore, webhookUrl: accessNotificationWebhookUrl,
          fetchImpl: accessNotificationFetchImpl,
          batchSize: accessNotificationBatchSize, maxRetries: accessNotificationMaxRetries,
        });
      } catch (error) {
        logServerError("access-notification-worker-loop", crypto.randomUUID(), error);
      }
    };
    void runWorker();
    const workerInterval = setInterval(() => { void runWorker(); }, accessNotificationWorkerIntervalMs);
    workerInterval.unref?.();
  }

  // ── Root + login redirects ────────────────────────────────────────────
  app.get("/", (_req, res) => res.redirect("/pj/admin"));
  app.get("/login", (_req, res) => res.redirect("/pj/admin"));

  // ── PJ landing page ────────────────────────────────────────────────
  const LANDING_HTML_FILE = path.join(PUBLIC_DIR, "index.html");
  app.get("/pj", (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.type("html").sendFile(LANDING_HTML_FILE);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to serve landing HTML:", (err as Error).message);
      res.status(503).json({ error: "Landing HTML not available" });
    }
  });

  // ── PJ workspace HTML routes ──────────────────────────────────────────
  const sendPjWorkspace = (res: express.Response): void => {
    try {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.type("html").send(renderPjWorkspaceHtml(PJ_WORKSPACE_FILE, trustedParentOrigins));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to serve PJ workspace HTML:", (err as Error).message);
      res.status(503).json({ error: "Workspace HTML not available" });
    }
  };
  app.get("/puddle-jumper", (_req, res) => sendPjWorkspace(res));
  app.get("/pj-workspace", (_req, res) => sendPjWorkspace(res));

  // ── Admin UI ──────────────────────────────────────────────────────────
  const ADMIN_HTML_FILE = path.join(PUBLIC_DIR, "admin.html");
  app.get("/pj/admin", (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.type("html").sendFile(ADMIN_HTML_FILE);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to serve admin HTML:", (err as Error).message);
      res.status(503).json({ error: "Admin HTML not available" });
    }
  });

  // ── Quick Start / Systems Map ─────────────────────────────────────────
  const GUIDE_HTML_FILE = path.join(PUBLIC_DIR, "guide.html");
  app.get("/pj/guide", (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.type("html").sendFile(GUIDE_HTML_FILE);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to serve guide HTML:", (err as Error).message);
      res.status(503).json({ error: "Guide HTML not available" });
    }
  });

  // ── Auth gating for /api ──────────────────────────────────────────────
  app.use("/api", (req, res, next) => {
    if (req.method === "POST" && req.path === "/login") { next(); return; }
    if (req.method === "POST" && req.path === "/refresh") { next(); return; }
    if (req.method === "POST" && req.path === "/auth/logout") { next(); return; }
    if (req.method === "POST" && req.path === "/auth/revoke") { optionalAuthMiddleware(req, res, next); return; }
    if (req.method === "POST" && req.path === "/prr/intake") { optionalAuthMiddleware(req, res, next); return; }
    if (req.method === "POST" && req.path === "/access/request") { optionalAuthMiddleware(req, res, next); return; }
    if (req.method === "GET" && /^\/connectors\/(?:microsoft|google|github)\/auth\/callback$/.test(req.path)) {
      optionalAuthMiddleware(req, res, next); return;
    }
    if (req.method === "GET" && req.path === "/pj/identity-token") { optionalAuthMiddleware(req, res, next); return; }
    if (req.method === "GET" && req.path === "/auth/status") { optionalAuthMiddleware(req, res, next); return; }
    if (req.method === "GET" && req.path === "/session") { next(); return; }
    if (req.method === "GET" && req.path === "/health") { next(); return; }
    if (req.path.startsWith("/auth/github/")) { next(); return; }
    if (req.path.startsWith("/auth/google/")) { next(); return; }
    if (req.path.startsWith("/auth/microsoft/")) { next(); return; }
    authMiddleware(req, res, next);
  });
  app.use("/api", csrfProtection());

  // /api/health — unauthenticated alias for /health (bypassed in auth gate above)
  app.get("/api/health", (_req, res) => { res.json({ status: "ok" }); });

  // GET /api/me — returns current user's profile + role from JWT
  app.get("/api/me", (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.json({
      sub: auth.sub,
      email: auth.email ?? null,
      name: auth.name ?? null,
      role: auth.role ?? "viewer",
      provider: auth.provider ?? null,
      workspaceId: auth.workspaceId ?? "system",
      workspaceName: auth.workspaceName ?? null,
    });
  });

  // ── Mount route modules ───────────────────────────────────────────────
  app.use("/api", createAuthRoutes({
    builtInLoginEnabled, loginUsers, loginRateLimit, nodeEnv, trustedParentOrigins,
  }));
  // Session lifecycle routes (refresh, /auth/logout, /auth/revoke, /auth/status,
  // /session, /admin/audit) — provided by logic-commons
  app.use("/api", createSessionRoutes({ nodeEnv }));
  // Rate-limit OAuth login redirects (10 req/min per IP)
  app.use("/api/auth/github/login", oauthLoginRateLimit);
  app.use("/api/auth/google/login", oauthLoginRateLimit);
  app.use("/api/auth/microsoft/login", oauthLoginRateLimit);
  // Mount generic OAuth routes for all three providers (via logic-commons factory)
  const onUserAuthenticated = (userInfo: UserInfo): UserInfo => {
    const row = upsertUser(CONTROLLED_DATA_DIR, {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      provider: userInfo.provider,
    });
    // Ensure personal workspace exists
    const ws = ensurePersonalWorkspace(CONTROLLED_DATA_DIR, row.id, row.name || row.sub);
    // Clone default template into new workspace if not present
    chainStore.cloneDefaultTemplateToWorkspace(ws.id);
    // Extend the returned object to include workspaceId and workspaceName
    return { ...userInfo, role: row.role, workspaceId: ws.id, workspaceName: ws.name } as typeof userInfo & { role: string; workspaceId: string; workspaceName: string };
  };
  const oauthRouteOpts = { nodeEnv, oauthStateStore, onUserAuthenticated };
  app.use("/api", createOAuthRoutes(githubProvider, oauthRouteOpts));
  app.use("/api", createOAuthRoutes(googleProvider, oauthRouteOpts));
  app.use("/api", createOAuthRoutes(microsoftProvider, oauthRouteOpts));
  app.use("/api", createConfigRoutes({ runtimeContext, runtimeTiles, runtimeCapabilities }));
  app.use("/api", createPrrRoutes({ prrStore }));
  app.use("/api", createAccessRoutes({ prrStore }));
  app.use("/api", createGovernanceRoutes({
    runtimeContext, runtimeTiles, runtimeCapabilities,
    canonicalSourceOptions: options.canonicalSourceOptions,
    msGraphFetchImpl, msGraphTokenExchangeEnabled, nodeEnv,
    evaluateRateLimit, promptRateLimit, pjExecuteRateLimit,
    approvalStore, chainStore, policyProvider,
  }));
  app.use("/api", createApprovalRoutes({
    approvalStore, dispatcherRegistry, nodeEnv, chainStore,
  }));
  app.use("/api", createChainTemplateRoutes({ chainStore }));
  app.use("/api", createAdminRoutes({ approvalStore, chainStore }));
  app.use("/api", createWorkspaceUsageRoutes());
  app.use("/api", createWebhookActionRoutes({
    approvalStore, dispatcherRegistry, chainStore,
  }));
  app.use("/api/connectors", createConnectorsRouter({
    store: connectorStore, stateHmacKey: connectorStateSecret,
  }));

  // ── Global error handler ──────────────────────────────────────────────
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof SyntaxError) { res.status(400).json({ error: "Invalid JSON body" }); return; }
    const correlationId = getCorrelationId(res);
    logServerError(`${req.method} ${req.path}`, correlationId, error);
    res.status(500).json({ error: "Internal server error", correlationId });
  });

  return app;
}

// ── Standalone launcher ─────────────────────────────────────────────────────
export function startServer() {
  // Validate required env vars before anything else
  try {
    loadConfig();
  } catch (err) {
    if (err instanceof StartupConfigError) {
      // eslint-disable-next-line no-console
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const app = createApp();
  const port = Number.parseInt(process.env.PORT ?? "3002", 10);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Puddle Jumper Deploy Remote running on http://localhost:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}

// Re-export for tests that may depend on it
export { processAccessNotificationQueueOnce } from "./accessNotificationWorker.js";
