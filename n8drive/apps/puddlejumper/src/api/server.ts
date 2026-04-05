// Load environment variables from .env file
import dotenv from 'dotenv';
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import crypto from "node:crypto";
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
import { DogStore } from "./dogStore.js";
import { ConnectorStore } from "./connectorStore.js";
import { CommonsStore } from "./commonsStore.js";
import { createPublicPrrRouter } from "./publicPrrRouter.js";
import { createConnectorsRouter, createConnectorCallbackMiddleware } from "./connectors.js";
import { createGitHubProxyRoutes } from "./routes/githubProxy.js";
import { createMicrosoftProxyRoutes } from "./routes/microsoftProxy.js";
import { createGoogleProxyRoutes } from "./routes/googleProxy.js";
import { createCloudSaveRoutes } from "./routes/cloudSave.js";
import { createDocumentRoutes } from "./routes/documents.js";
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
  requestLogger,
  createErrorHandler,
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
  createTokenExchangeRoutes,
  type UserInfo,
} from "@publiclogic/logic-commons";

// Route modules
import { createAuthRoutes } from "./routes/auth.js";
import { upsertUser, setUserRole, linkEmailToUser, resolveLinkedUser } from "./userStore.js";
import { findLocalUserById } from "./localUsersStore.js";
import { createConfigRoutes } from "./routes/config.js";
import { createPrrRoutes } from "./routes/prr.js";
import { createCommonsRoutes } from "./routes/commons.js";
import { createDogRoutes } from "./routes/dog.js";
import { createAccessRoutes } from "./routes/access.js";
import { createGovernanceRoutes } from "./routes/governance.js";
import { createApprovalRoutes } from "./routes/approvals.js";
import { createChainTemplateRoutes } from "./routes/chainTemplates.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createAdminMembersRoutes } from "./routes/adminMembers.js";
import { createWebhookActionRoutes } from "./routes/webhookAction.js";
import { createWorkspaceUsageRoutes } from "./routes/workspaceUsage.js";
import { createPrefsRoutes } from "./routes/prefs.js";
import { createWorkspaceCollaborationRoutes } from "./routes/workspaceCollaboration.js";
import { createCaseSpacesRoutes } from "./routes/casespaces.js";
import { createAxisChatRoutes } from "./routes/axisChatRoutes.js";
import { createPublicPRRRoutes } from "./routes/publicPrr.js";
import { createAdminPRRRoutes } from "./routes/prrAdmin.js";
import { createVaultRoutes } from "./routes/vault.js";
import { createModuleBuilderRouter } from "./routes/vaultModules.js";
import { initArchieve, createArchieveRouter, getArchieveQueueDepth } from "../archieve/index.js";
import { initSeal, getSealHealth, createSealRouter } from "../seal/index.js";
import { initSyncronate, createSyncronateRouter, getSyncronateHealth } from "../syncronate/index.js";
import { initLogicBridge, createLogicBridgeRouter, getLogicBridgeHealth } from "../logicbridge/index.js";
import { initFormKey, createFormKeyRouter, getFormKeyHealth } from "../formkey/index.js";
import { initWatchLayer, createWatchRouter, scheduleWatchLayer } from "../watchlayer/index.js";
import { initOrgManager, createOrgManagerRouter } from "../org-manager/index.js";
import { initFinance, createFinanceRouter } from "../finance/index.js";
import { initPRR, createPrrRouter } from "../prr/index.js";
import { initFiscalDb, createFiscalRoutes } from "../fiscalintel/index.js";
import { scheduleDailyRegistrySync } from "../townregistry/dailySync.js";
import { createTownRegistryRoutes } from "../townregistry/routes.js";
import { createMyHealthRoutes } from "./routes/myHealth.js";
import { ApprovalStore } from "../engine/approvalStore.js";
import { ChainStore } from "../engine/chainStore.js";
import { LocalPolicyProvider } from "../engine/policyProvider.js";
import { createPolicyProvider } from "../engine/remotePolicyProvider.js";
import { DispatcherRegistry } from "../engine/dispatch.js";
import { GitHubDispatcher } from "../engine/dispatchers/github.js";
import { SlackDispatcher } from "../engine/dispatchers/slack.js";
import { WebhookDispatcher } from "../engine/dispatchers/webhook.js";
import { SharePointDispatcher } from "../engine/dispatchers/sharepoint.js";
import { approvalMetrics, METRIC, METRIC_HELP } from "../engine/approvalMetrics.js";
import { loadConfig, StartupConfigError } from "./startupConfig.js";
import { ensurePersonalWorkspace, getDb, acceptInvitation } from "../engine/workspaceStore.js";
import { requireToolAccess } from "./middleware/checkWorkspaceRole.js";

// ── Directory layout ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from repository root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const ROOT_DIR = path.resolve(__dirname, "../../");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const INTERNAL_SRC_DIR = path.join(ROOT_DIR, "src", "internal-remote");
const CONTROLLED_DATA_DIR = path.join(ROOT_DIR, "data");

// ── Seed email links from env on startup ────────────────────────────────────
// Format: LINKED_EMAILS=alt@email.com:primary@email.com,other@email.com:primary@email.com
// The primary email must already exist (or will be resolved after first login).
// This is processed lazily inside onUserAuthenticated so DB is ready.
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
  const dogStore = new DogStore(path.join(CONTROLLED_DATA_DIR, "dog.db"));
  const connectorStore = new ConnectorStore(connectorDbPath);
  const commonsStore = new CommonsStore(path.join(CONTROLLED_DATA_DIR, "commons.db"));
  const oauthStateDbPath = path.join(CONTROLLED_DATA_DIR, "oauth_state.db");
  const oauthStateStore = new OAuthStateStore(oauthStateDbPath);
  const approvalDbPath = path.resolve(process.env.APPROVAL_DB_PATH ?? DEFAULT_APPROVAL_DB_PATH);
  if (!isPathInsideDirectory(approvalDbPath, CONTROLLED_DATA_DIR)) {
    throw new Error("APPROVAL_DB_PATH must be inside the controlled data directory");
  }
  const approvalStore = new ApprovalStore(approvalDbPath);
  const chainStore = new ChainStore(approvalStore.db);

  // ── ARCHIEVE immutable audit log ──────────────────────────────────────
  initArchieve(approvalStore.db, CONTROLLED_DATA_DIR);
  initSeal(approvalStore.db);
  initSyncronate(approvalStore.db);
  // ── LOGICBRIDGE connector registry + handler runner ───────────────────
  initLogicBridge(approvalStore.db, connectorStore).catch(err => {
    console.error('[logicbridge] init error:', (err as Error).message);
  });

  // ── FORMKEY intake + output module ────────────────────────────────────
  initFormKey(approvalStore.db).catch(err => {
    console.error('[formkey] init error:', (err as Error).message);
  });

  // ── WATCHLAYER continuous monitoring ─────────────────────────────────
  initWatchLayer(approvalStore.db);
  scheduleWatchLayer(approvalStore.db);

  // ── FiscalIntel — MA DLS municipal data connector ─────────────────────
  initFiscalDb(approvalStore.db);
  scheduleDailyRegistrySync(approvalStore.db);
  initOrgManager(approvalStore.db);
  initFinance(approvalStore.db);
  initPRR(approvalStore.db);
  
  // ── PolicyProvider: Local or Remote (Vault) ──────────────────────────
  // If VAULT_URL is set, use RemotePolicyProvider to call Vault HTTP service.
  // Otherwise, use LocalPolicyProvider (SQLite-backed, shipped with PJ today).
  // This enables config-swap migration without code rewrite.
  const localPolicyProvider = new LocalPolicyProvider(approvalStore.db, chainStore);
  const policyProvider = createPolicyProvider(
    localPolicyProvider,
    // getAccessToken: extract JWT from request context (future: implement proper token refresh)
    async () => {
      // For now, we don't pass a token - Vault will use the same JWT from cookies
      // In production, we'd implement proper service-to-service token exchange
      return null;
    }
  );
  
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
  const prrRateLimit = createRateLimit({
    windowMs: 60_000, max: 10,
    keyGenerator: (req) => `public-prr:ip:${req.ip}`,
  });

  // ── Express app ───────────────────────────────────────────────────────
  const app = express();

  // Global middleware (must come before routes for CORS to apply)
  app.use(withCorrelationId);
  app.use(requestLogger);
  app.use(createCorsMiddleware(nodeEnv));

  // Add HSTS and Referrer-Policy headers for production
  if (nodeEnv === "production") {
    app.use((_req, res, next) => {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      next();
    });
  }

  // Pre-auth routes
  app.get("/health", (_req, res) => {
    const checks: Record<string, { status: string; detail?: string }> = {};

    // Database connectivity — PRR, connectors, and approvals
    for (const [label, store] of [
      ["prr", prrStore],
      ["connectors", connectorStore],
      ["approvals", approvalStore],
    ] as const) {
      try {
        (store as any).db.prepare("SELECT 1").get();
        checks[label] = { status: "ok" };
      } catch (err: unknown) {
        checks[label] = { status: "error", detail: err instanceof Error ? err.message : String(err) };
      }
    }

    // Volume writability — verify data directory is read/write
    const volumeProbe = path.join(CONTROLLED_DATA_DIR, `.health-probe-${Date.now()}`);
    try {
      fs.writeFileSync(volumeProbe, "ok", "utf8");
      const readBack = fs.readFileSync(volumeProbe, "utf8");
      fs.unlinkSync(volumeProbe);
      checks.volume = readBack === "ok" ? { status: "ok" } : { status: "error", detail: "read-back mismatch" };
    } catch (err: unknown) {
      checks.volume = { status: "error", detail: err instanceof Error ? err.message : String(err) };
      // Best-effort cleanup — primary error is already surfaced in checks.volume
      try { fs.unlinkSync(volumeProbe); } catch { /* probe file may not exist */ }
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
  // /v1/health — spec-compliant health endpoint (PJ Build Spec §8.1)
  app.get("/v1/health", (_req, res) => {
    const checks: Record<string, { status: string; detail?: string }> = {};
    for (const [label, store] of [
      ["prr", prrStore],
      ["connectors", connectorStore],
      ["approvals", approvalStore],
    ] as const) {
      try {
        (store as any).db.prepare("SELECT 1").get();
        checks[label] = { status: "ok" };
      } catch (err: unknown) {
        checks[label] = { status: "error", detail: err instanceof Error ? err.message : String(err) };
      }
    }
    const volumeProbe = path.join(CONTROLLED_DATA_DIR, `.health-probe-${Date.now()}`);
    try {
      fs.writeFileSync(volumeProbe, "ok", "utf8");
      const readBack = fs.readFileSync(volumeProbe, "utf8");
      fs.unlinkSync(volumeProbe);
      checks.volume = readBack === "ok" ? { status: "ok" } : { status: "error", detail: "read-back mismatch" };
    } catch (err: unknown) {
      checks.volume = { status: "error", detail: err instanceof Error ? err.message : String(err) };
      try { fs.unlinkSync(volumeProbe); } catch { /* probe file may not exist */ }
    }
    const overall = Object.values(checks).every((c) => c.status === "ok") ? "ok" : "degraded";
    const uptimeSeconds = Math.floor(process.uptime());
    // Spec §8.1 response format
    res.json({
      status: overall,
      timestamp: new Date().toISOString(),
      version: process.env.PJ_VERSION ?? "1.0.0",
      region: process.env.PJ_REGION ?? process.env.FLY_REGION ?? "unknown",
      uptime_seconds: uptimeSeconds,
      subsystems: {
        vault:            { status: checks.prr?.status === "ok" ? "ok" : "degraded", reachable: checks.prr?.status === "ok" },
        archieve:         { status: "ok", queueDepth: getArchieveQueueDepth(), oldestQueuedItemAgeSeconds: 0 },
        seal:             getSealHealth(),
        kms:              { status: "ok", latencyMs: 0, lastCheckedAt: new Date().toISOString() },
        axis:             { status: "ok", providersLive: 0, providersDegraded: 0 },
        synchron8:        { status: "ok" },
        logicbridge:      getLogicBridgeHealth(),
        syncronate:       getSyncronateHealth(),
        casespaceFactory: { status: checks.connectors?.status === "ok" ? "ok" : "degraded" },
        formkey:          getFormKeyHealth(),
        templateLibrary:  { status: "ok", templatesLoaded: 0 },
        spark:            { status: "ok", handlersExecuting: 0 },
        volume:           { status: checks.volume?.status === "ok" ? "ok" : "degraded", reachable: checks.volume?.status === "ok" },
      },
      alerts: overall === "ok" ? [] : Object.entries(checks).filter(([, v]) => v.status !== "ok").map(([k]) => `${k}_unhealthy`),
    });
  });

  // /v1/metrics — Prometheus metrics alias (spec §8.2)
  app.get("/v1/metrics", (req, res) => res.redirect(307, "/metrics"));

  app.get("/ready", (_req, res) => {
    // Lightweight readiness probe — verifies DB connectivity only
    try {
      (prrStore as any).db.prepare("SELECT 1").get();
      (approvalStore as any).db.prepare("SELECT 1").get();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not_ready" });
    }
  });
  app.get("/metrics", (req, res) => {
    // METRICS_TOKEN must be set; unauthenticated access is never allowed.
    const metricsToken = process.env.METRICS_TOKEN;
    if (!metricsToken) {
      res.status(503).json({ error: "Metrics not available: METRICS_TOKEN not configured" });
      return;
    }
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${metricsToken}`) {
      res.status(401).json({ error: "Invalid or missing metrics token" });
      return;
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
  // These are handled by Next.js in production, but keep for dev/legacy fallback
  if (nodeEnv !== "production") {
    app.get("/", (_req, res) => res.redirect("/pj/admin"));
    app.get("/login", (_req, res) => res.redirect("/pj/admin"));
  }

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
  // Legacy static admin shell (separate from Next.js /admin page)
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
  app.get("/guide", (_req, res) => res.redirect(301, "/pj/guide"));
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

  // ── Portal Sign-In ───────────────────────────────────────────────────
  const SIGNIN_HTML_FILE = path.join(PUBLIC_DIR, "portal-signin.html");
  app.get("/pj/signin", (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.type("html").sendFile(SIGNIN_HTML_FILE);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to serve signin HTML:", (err as Error).message);
      res.status(503).json({ error: "Signin HTML not available" });
    }
  });

  // ── Auth gating for /api ──────────────────────────────────────────────
  app.use("/api", (req, res, next) => {
    if (req.method === "OPTIONS") { next(); return; }
    if (req.method === "POST" && req.path === "/login") { next(); return; }
    if (req.method === "POST" && req.path === "/refresh") { next(); return; }
    if (req.method === "POST" && req.path === "/auth/logout") { next(); return; }
    if (req.method === "POST" && req.path === "/auth/token-exchange") { next(); return; }
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
    if (req.method === "GET" && req.path === "/v1/health") { next(); return; }
    if (req.method === "GET" && req.path === "/seal/health") { next(); return; }
    if (req.method === "GET" && req.path === "/archieve/health") { next(); return; }
    if (req.method === "GET" && req.path === "/v1/metrics") { next(); return; }
    if (req.path.startsWith("/auth/github/")) { next(); return; }
    if (req.path.startsWith("/auth/google/")) { next(); return; }
    if (req.path.startsWith("/auth/microsoft/")) { next(); return; }
    authMiddleware(req, res, next);
  });
  // Normalize auth context: copy tenantId → workspaceId so all route handlers
  // can use auth.workspaceId regardless of which JWT claim carries it.
  app.use("/api", (req: any, _res, next) => {
    if (req.auth && !req.auth.workspaceId && req.auth.tenantId) {
      req.auth.workspaceId = req.auth.tenantId;
    }
    next();
  });
  // GitHub proxy is cross-origin (LogicOS on Vercel → PJ on Fly.io) — CSRF
  // protection is provided by CORS + SameSite=None cookie rather than CSRF token.
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/github/")) { next(); return; }
    if (req.path.startsWith("/microsoft/")) { next(); return; }
    if (req.path.startsWith("/google/")) { next(); return; }
    if (req.path.startsWith("/connectors/")) { next(); return; }
    if (req.path.startsWith("/cloud-save")) { next(); return; }
    if (req.path.startsWith("/documents")) { next(); return; }
    if (req.path.startsWith("/vault-files")) { next(); return; }
    csrfProtection()(req, res, next);
  });

  // /api/health — unauthenticated alias for /health (bypassed in auth gate above)
  app.get("/api/health", (_req, res) => { res.json({ status: "ok" }); });

  // /seal/health — SEAL module health (unauthenticated, used by LogicOS diagnostics)
  app.get("/seal/health", (_req, res) => {
    try {
      const health = getSealHealth();
      const status = health.signingKeyStatus === "loaded" ? "ok"
        : health.signingKeyStatus === "partially_loaded" ? "degraded"
        : "unavailable";
      res.json({ status, ...health });
    } catch {
      res.status(500).json({ status: "error", detail: "SEAL health check failed" });
    }
  });

  // /archieve/health — ARCHIEVE module health (unauthenticated, used by LogicOS diagnostics)
  app.get("/archieve/health", (_req, res) => {
    try {
      const queueDepth = getArchieveQueueDepth();
      res.json({ status: "ok", queueDepth });
    } catch {
      res.status(500).json({ status: "error", detail: "ARCHIEVE health check failed" });
    }
  });

  // GET /api/me — returns current user's profile + role from JWT
  app.get("/api/me", (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }

    // Allowlist check on every request — catches pre-existing sessions from before the allowlist was enabled
    const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const allowedDomains = (process.env.ALLOWED_DOMAINS ?? '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    if (allowedEmails.length > 0 || allowedDomains.length > 0) {
      const dataDir = process.env.DATA_DIR || "./data";
      const localUser = findLocalUserById(dataDir, auth.sub);
      if (localUser) {
        res.json({
          sub: auth.sub,
          email: auth.email ?? localUser.email ?? null,
          name: auth.name ?? localUser.name ?? null,
          role: auth.role ?? "viewer",
          provider: auth.provider ?? null,
          workspaceId: auth.workspaceId ?? "system",
          workspaceName: auth.workspaceName ?? null,
          mustChangePassword: (auth as any).mustChangePassword ?? false,
        });
        return;
      }
      const email = (auth.email ?? '').toLowerCase()
      const domain = email.split('@')[1] ?? ''
      const permitted = allowedEmails.includes(email) || allowedDomains.includes(domain)
      if (!permitted) {
        console.warn(`[auth] /api/me blocked for session with email: ${email}`)
        res.status(403).json({ error: "Access denied — your account is not authorized for this workspace." }); return;
      }
    }

    res.json({
      sub: auth.sub,
      email: auth.email ?? null,
      name: auth.name ?? null,
      role: auth.role ?? "viewer",
      provider: auth.provider ?? null,
      workspaceId: auth.workspaceId ?? "system",
      workspaceName: auth.workspaceName ?? null,
      mustChangePassword: (auth as any).mustChangePassword ?? false,
    });
  });

  // ── Mount route modules ───────────────────────────────────────────────
  app.use("/api", createAuthRoutes({
    builtInLoginEnabled, loginUsers, loginRateLimit, nodeEnv, trustedParentOrigins,
    dataDir: CONTROLLED_DATA_DIR,
  }));
  // Session lifecycle routes (refresh, /auth/logout, /auth/revoke, /auth/status,
  // /session, /admin/audit) — provided by logic-commons
  app.use("/api", createSessionRoutes({ nodeEnv }));
  // Rate-limit OAuth login redirects (10 req/min per IP)
  app.use("/api/auth/github/login", loginRateLimit);
  app.use("/api/auth/google/login", loginRateLimit);
  app.use("/api/auth/microsoft/login", loginRateLimit);
  // Mount generic OAuth routes for all three providers (via logic-commons factory)
  const onUserAuthenticated = (userInfo: UserInfo): UserInfo => {
    // ── Access allowlist ──────────────────────────────────────────────────────
    // ALLOWED_EMAILS: comma-separated list of exact emails that may log in
    // ALLOWED_DOMAINS: comma-separated list of email domains (e.g. publiclogic.org)
    // If neither env var is set, ALL authenticated users are allowed (open mode).
    const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const allowedDomains = (process.env.ALLOWED_DOMAINS ?? '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

    if (allowedEmails.length > 0 || allowedDomains.length > 0) {
      const email = (userInfo.email ?? '').toLowerCase()
      const domain = email.split('@')[1] ?? ''
      const permitted = allowedEmails.includes(email) || allowedDomains.includes(domain)
      if (!permitted) {
        console.warn(`[auth] Blocked login attempt from: ${email} (not in allowlist)`)
        throw Object.assign(new Error('Access denied — your account is not authorized for this workspace.'), { statusCode: 403 })
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Seed env-defined email links (LINKED_EMAILS=alt:primary,alt2:primary) ──
    const linkedEmailsEnv = (process.env.LINKED_EMAILS ?? '').trim();
    if (linkedEmailsEnv) {
      for (const pair of linkedEmailsEnv.split(',')) {
        const [alt, primaryEmail] = pair.split(':').map(s => s.trim().toLowerCase());
        if (!alt || !primaryEmail) continue;
        try {
          // Find the primary user by email
          const primaryRow = (getDb(CONTROLLED_DATA_DIR)
            .prepare("SELECT sub, provider FROM users WHERE LOWER(email) = ? LIMIT 1")
            .get(primaryEmail) as { sub: string; primary_provider: string } | undefined) as any;
          if (primaryRow) linkEmailToUser(CONTROLLED_DATA_DIR, alt, primaryRow.sub, primaryRow.provider);
        } catch {
          // users table may not exist yet on a fresh DB; upsertUser below will create it
        }
      }
    }

    // ── Account linking: if this email is linked to a primary account, use that ──
    // This lets one user sign in with multiple emails (e.g. personal + work) and
    // always land on the same workspace, role, and data.
    let row: ReturnType<typeof upsertUser>;
    const linkedPrimary = userInfo.email ? resolveLinkedUser(CONTROLLED_DATA_DIR, userInfo.email) : null;
    if (linkedPrimary) {
      // Use the primary account record — sub/workspaceId will match the primary
      row = linkedPrimary;
    } else {
      row = upsertUser(CONTROLLED_DATA_DIR, {
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        provider: userInfo.provider,
      });
    }


    // Auto-promote to admin if the user's email is in the ADMIN_EMAILS allowlist
    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.length > 0 && userInfo.email && adminEmails.includes(userInfo.email.toLowerCase())) {
      if (row.role !== 'admin') {
        setUserRole(CONTROLLED_DATA_DIR, row.sub, row.provider, 'admin');
        row.role = 'admin';
      }
    }
    // Ensure personal workspace exists — use row.sub (OAuth subject) as the
    // stable user identifier so auth.sub always matches workspace.owner_id
    const ws = ensurePersonalWorkspace(CONTROLLED_DATA_DIR, row.sub, row.name || row.sub);
    // Clone default template into new workspace if not present
    chainStore.cloneDefaultTemplateToWorkspace(ws.id);
    
    // Check for pending invitations for this user's email and auto-accept
    if (userInfo.email) {
      try {
        const db = getDb(CONTROLLED_DATA_DIR);
        const pendingInvites = db.prepare(`
          SELECT * FROM workspace_invitations 
          WHERE email = ? AND accepted_at IS NULL AND expires_at > datetime('now')
        `).all(userInfo.email.toLowerCase());
        
        for (const invite of pendingInvites as any[]) {
          try {
            acceptInvitation(CONTROLLED_DATA_DIR, invite.token, row.sub);
          } catch (err) {
            // Ignore errors (user might already be a member)
          }
        }
      } catch (err) {
        // Ignore invitation check errors
      }
    }
    
    // Extend the returned object to include workspaceId and workspaceName
    return { ...userInfo, role: row.role, tenantId: ws.id, userId: row.sub, workspaceId: ws.id, workspaceName: ws.name } as typeof userInfo & { role: string; tenantId: string; userId: string; workspaceId: string; workspaceName: string };
  };
  const oauthRouteOpts = { nodeEnv, oauthStateStore, onUserAuthenticated, frontendUrl: (process.env.LOGIC_COMMONS_URL ?? "").trim() || "https://logicos-rho.vercel.app" };
  // Auto-connect connector store when user signs in with any provider
  const onTokenExchanged = async ({ provider, accessToken, refreshToken, userInfo }: { provider: string; accessToken: string; refreshToken: string | null; userInfo: any }) => {
    const tenantId = userInfo.tenantId ?? "";
    const userId = userInfo.userId ?? userInfo.sub ?? "";
    if (!tenantId || !userId) return;
    const account = userInfo.email ?? userInfo.name ?? null;
    try {
      if (provider === "github") {
        const profileRes = await fetch("https://api.github.com/user", {
          headers: { Authorization: `token ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "puddle-jumper" },
        });
        const profile = profileRes.ok ? (await profileRes.json() as Record<string, unknown>) : {};
        connectorStore.upsertToken({ provider: "github", tenantId, userId, account: typeof profile.login === "string" ? profile.login : account, scopes: ["read:user", "repo"], accessToken, refreshToken: null, expiresAt: null });
      } else if (provider === "google") {
        connectorStore.upsertToken({ provider: "google", tenantId, userId, account, scopes: ["openid", "email", "profile", "drive.file", "gmail.readonly", "calendar.readonly"], accessToken, refreshToken: refreshToken ?? null, expiresAt: null });
      } else if (provider === "microsoft") {
        connectorStore.upsertToken({ provider: "microsoft", tenantId, userId, account, scopes: ["openid", "email", "profile", "User.Read", "Files.ReadWrite", "Mail.Read", "Calendars.Read"], accessToken, refreshToken: refreshToken ?? null, expiresAt: null });
      }
    } catch (err: any) {
      console.warn(`${provider} connector auto-connect failed:`, err?.message);
    }
  };
  const allOauthRouteOpts = { ...oauthRouteOpts, onTokenExchanged };
  // Intercept /api/auth/github/callback before the login handler — if the `state`
  // is a signed connector state (user connecting GitHub while logged in as another
  // provider), store the token and redirect; otherwise fall through to login flow.
  app.get("/api/auth/github/callback", createConnectorCallbackMiddleware({
    stateHmacKey: connectorStateSecret, store: connectorStore,
  }));
  app.get("/api/auth/google/callback", createConnectorCallbackMiddleware({
    stateHmacKey: connectorStateSecret, store: connectorStore,
  }));
  app.use("/api", createOAuthRoutes(githubProvider, allOauthRouteOpts));
  app.use("/api", createOAuthRoutes(googleProvider, allOauthRouteOpts));
  app.use("/api", createOAuthRoutes(microsoftProvider, allOauthRouteOpts));
  // Token exchange (SSO bridge — lets OS exchange an MSAL token for a PJ session)
  app.use("/api/auth/token-exchange", loginRateLimit);
  app.use("/api", createTokenExchangeRoutes({
    nodeEnv,
    providers: { microsoft: microsoftProvider, google: googleProvider, github: githubProvider },
    onUserAuthenticated,
  }));
  app.use("/api", createConfigRoutes({ runtimeContext, runtimeTiles, runtimeCapabilities }));
  app.use("/api", createPrrRoutes({ prrStore }));
  app.use("/api", createCommonsRoutes({ commonsStore }));
  app.use("/api", createDogRoutes({ dogStore }));
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
  app.use("/api", createAdminMembersRoutes());
  app.use("/api", createWorkspaceUsageRoutes());
  app.use("/api", createPrefsRoutes());
  app.use("/api", createWorkspaceCollaborationRoutes());
  // Tool access enforcement — server-side mirror of canUseTool() in LogicOS
  app.use("/api/v1/casespaces", requireToolAccess("casespaces"));
  app.use("/api", createCaseSpacesRoutes());
  app.use("/api", createAxisChatRoutes());
  app.use("/api/vault", requireToolAccess("vault"));
  app.use("/api", createVaultRoutes({ 
    dataDir: CONTROLLED_DATA_DIR, 
    vaultUrl: process.env.VAULT_URL 
  }));
  app.use("/api/v1/vault/modules", createModuleBuilderRouter(CONTROLLED_DATA_DIR));
  app.use("/api/v1/watch", requireToolAccess("admin"), createWatchRouter(approvalStore.db));
  app.use("/api/archieve", requireToolAccess("admin"), createArchieveRouter(approvalStore.db));
  app.use("/api/seal", requireToolAccess("admin"), createSealRouter(approvalStore.db));
  app.use("/api/syncronate", requireToolAccess("admin"), createSyncronateRouter(approvalStore.db));
  app.use("/api/logicbridge", requireToolAccess("logicbridge"), createLogicBridgeRouter());
  app.use("/api/formkey/forms", requireToolAccess("formkey"), createFormKeyRouter(approvalStore.db));
  app.use("/v1/forms", createFormKeyRouter(approvalStore.db)); // public form submissions — no tool gate
  app.use("/api/v1/org", requireToolAccess("admin"), createOrgManagerRouter(approvalStore.db));
  app.use("/api/v1/finance", requireToolAccess("admin"), createFinanceRouter(approvalStore.db));
  app.use("/api/prr", requireToolAccess("admin"), createPrrRouter(approvalStore.db));
  app.use("/public/prr", prrRateLimit);
  app.use(createPublicPRRRoutes({ dataDir: CONTROLLED_DATA_DIR }));
  app.use("/api", createAdminPRRRoutes());
  app.use("/api", createWebhookActionRoutes({
    approvalStore, dispatcherRegistry, chainStore,
  }));
  app.use("/api/connectors", createConnectorsRouter({
    store: connectorStore, stateHmacKey: connectorStateSecret,
  }));
  app.use("/api/github", createGitHubProxyRoutes({ store: connectorStore }));
  app.use("/api/microsoft", createMicrosoftProxyRoutes({ store: connectorStore }));
  app.use("/api/google", createGoogleProxyRoutes({ store: connectorStore }));
  app.use("/api/cloud-save", createCloudSaveRoutes({ store: connectorStore }));
  app.use("/api/fiscal", createFiscalRoutes(approvalStore.db));
  app.use("/api/registry", createTownRegistryRoutes(approvalStore.db));
  app.use("/api", createMyHealthRoutes(approvalStore.db));

  const vaultDbPath = path.resolve(process.env.VAULT_DB_PATH ?? path.join(CONTROLLED_DATA_DIR, "vault.db"));
  const documentRoutes = createDocumentRoutes({ dbPath: vaultDbPath });
  app.use("/api", documentRoutes);

  // ── Redirects ────────────────────────────────────────────────────────────
  // Redirect /admin and /dashboard to the working backend admin interface at /pj/admin
  app.get("/admin", (req, res) => {
    res.redirect(302, "/pj/admin");
  });
  app.get("/dashboard", (req, res) => {
    res.redirect(302, "/pj/admin");
  });

  // ── Global error handler ──────────────────────────────────────────────
  app.use(createErrorHandler(nodeEnv));

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
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Puddle Jumper Deploy Remote running on http://localhost:${port}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────
  const shutdownGracePeriodMs = 10_000;
  let shuttingDown = false;

  const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: "info", scope: "server.shutdown", signal, timestamp: new Date().toISOString() }));

    server.close(() => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ level: "info", scope: "server.shutdown.complete", timestamp: new Date().toISOString() }));
      process.exit(0);
    });

    // Force exit after grace period
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ level: "error", scope: "server.shutdown.forced", timestamp: new Date().toISOString() }));
      process.exit(1);
    }, shutdownGracePeriodMs).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}

// Re-export for tests that may depend on it
export { processAccessNotificationQueueOnce } from "./accessNotificationWorker.js";
