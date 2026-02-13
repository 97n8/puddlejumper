// eslint-disable-next-line no-console
console.log("[EARLY BOOT DEBUG] Raw env at module load:", {
  NODE_ENV: process.env.NODE_ENV,
  CONTROLLED_DATA_DIR: process.env.CONTROLLED_DATA_DIR,
  PRR_DB_PATH: process.env.PRR_DB_PATH,
  IDEMPOTENCY_DB_PATH: process.env.IDEMPOTENCY_DB_PATH,
  RATE_LIMIT_DB_PATH: process.env.RATE_LIMIT_DB_PATH,
  CONNECTOR_DB_PATH: process.env.CONNECTOR_DB_PATH
});

import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import {
  type AuthContext,
  createOptionalJwtAuthenticationMiddleware,
  createJwtAuthenticationMiddleware,
  csrfProtection,
  getAuthContext,
  requireAuthenticated,
  requirePermission,
  requireRole,
  resolveAuthOptions,
  signJwt,
  setJwtCookieOnResponse,
  type AuthOptions
} from "@publiclogic/core";
import authCallback from "./authCallback.js";
import { createRateLimit } from "./rateLimit.js";
import {
  accessRequestCloseRequestSchema,
  accessRequestIntakeRequestSchema,
  accessRequestStatusSchema,
  accessRequestStatusTransitionRequestSchema,
  evaluateRequestSchema,
  loginRequestSchema,
  pjExecuteRequestSchema,
  prrCloseRequestSchema,
  prrIntakeRequestSchema,
  prrStatusSchema,
  prrStatusTransitionRequestSchema,
  type EvaluateRequestBody,
  type PjExecuteRequestBody
} from "./schemas.js";
import { createDefaultEngine, type DecisionResult } from "../engine/governanceEngine.js";
import { getSystemPromptText } from "../prompt/systemPrompt.js";
import type { CanonicalSourceOptions } from "./canonicalSource.js";
import { PrrStore, type AccessRequestStatus, type PrrStatus } from "./prrStore.js";
import { createPublicPrrRouter } from "./publicPrrRouter.js";
import { ConnectorStore } from "./connectorStore.js";
import { createConnectorsRouter } from "./connectors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const INTERNAL_SRC_DIR = path.join(ROOT_DIR, "src", "internal-remote");
const NODE_ENV = (process.env.NODE_ENV ?? "development").trim() || "development";
const CONTROLLED_DATA_DIR_INPUT = process.env.CONTROLLED_DATA_DIR ?? "";
// eslint-disable-next-line no-console
console.log("[invariant-debug] NODE_ENV:", NODE_ENV);
// eslint-disable-next-line no-console
console.log("[invariant-debug] CONTROLLED_DATA_DIR raw env:", JSON.stringify(CONTROLLED_DATA_DIR_INPUT));
// eslint-disable-next-line no-console
console.log(
  "[invariant-debug] CONTROLLED_DATA_DIR resolved:",
  resolveControlledDataDir(NODE_ENV)
);
const PJ_WORKSPACE_FILE = path.join(PUBLIC_DIR, "puddlejumper-master-environment-control.html");
const PJ_WORKSPACE_FALLBACK_FILE = path.resolve(
  ROOT_DIR,
  "../website/public/public/puddlejumper-master-environment-control.html"
);
const PJ_WORKSPACE_CANDIDATE_PATHS = Array.from(
  new Set([PJ_WORKSPACE_FILE, PJ_WORKSPACE_FALLBACK_FILE].map((candidate) => path.resolve(candidate)))
);

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

type LoginRequestBody = {
  username: string;
  password: string;
};

type LoginUser = {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: string;
  permissions: string[];
  tenants: Array<{ id: string; name: string; sha: string; connections: string[] }>;
  tenantId: string | null;
};

type RuntimeCharter = {
  authority: boolean;
  accountability: boolean;
  boundary: boolean;
  continuity: boolean;
};

type RuntimeWorkspace = {
  id: string;
  name?: string;
  charter: RuntimeCharter;
};

type RuntimeMunicipality = {
  id: string;
  name?: string;
  state?: string;
  population?: number;
  statutes?: Record<string, string>;
  policies?: Record<string, Record<string, unknown>>;
  risk_profile?: Record<string, unknown>;
};

type RuntimeActionDefaults = {
  mode?: "launch" | "governed";
  intent?: string;
  targets?: string[];
  environment?: "production" | "staging" | "pilot";
  description?: string;
};

type RuntimeContext = {
  workspace: RuntimeWorkspace;
  municipality: RuntimeMunicipality;
  actionDefaults?: RuntimeActionDefaults;
};

type LiveTile = {
  id: string;
  label: string;
  icon: string;
  mode: "launch" | "governed";
  intent: string;
  target: string;
  tone: string;
  description: string;
  emergency?: boolean;
};

type CapabilityAutomation = {
  type: "automation";
  id: string;
  title: string;
  icon: string;
  desc: string;
  tags: string[];
  status: string;
  modal?: string;
};

type CapabilityAction = {
  type: "action";
  trigger: string[];
  title: string;
  icon: string;
  desc: string;
  hint: string;
  modal?: string;
};

type LiveCapabilities = {
  automations: CapabilityAutomation[];
  quickActions: CapabilityAction[];
};

type CapabilityKey =
  | "corePrompt.read"
  | "corePrompt.edit"
  | "evaluate.execute"
  | "missionControl.tiles.read"
  | "missionControl.tiles.customize"
  | "missionControl.capabilities.read"
  | "popout.launch";

type CapabilityManifest = {
  tenantId: string | null;
  userId: string;
  capabilities: Record<CapabilityKey, boolean>;
};

type PjActionId =
  | "environment.create"
  | "environment.update"
  | "environment.promote"
  | "environment.snapshot";

type PjActionDefinition = {
  id: PjActionId;
  label: string;
  requires: CapabilityKey[];
};

const PJ_ACTION_DEFINITIONS: readonly PjActionDefinition[] = [
  {
    id: "environment.create",
    label: "Create Environment",
    requires: ["evaluate.execute", "missionControl.tiles.customize"]
  },
  {
    id: "environment.update",
    label: "Update Environment",
    requires: ["evaluate.execute", "missionControl.tiles.customize"]
  },
  {
    id: "environment.promote",
    label: "Promote Environment",
    requires: ["evaluate.execute", "missionControl.tiles.customize"]
  },
  {
    id: "environment.snapshot",
    label: "Snapshot Environment",
    requires: ["evaluate.execute", "missionControl.tiles.customize"]
  }
];

const SESSION_COOKIE_NAME = "jwt";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 10;
const CORRELATION_ID_HEADER = "x-correlation-id";
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const DEFAULT_ACCESS_NOTIFICATION_INTERVAL_MS = 30_000;
const DEFAULT_ACCESS_NOTIFICATION_BATCH_SIZE = 25;
const DEFAULT_ACCESS_NOTIFICATION_MAX_RETRIES = 8;
const MS_GRAPH_TOKEN_HEADER = "x-ms-graph-token";
const DEFAULT_GRAPH_PROFILE_URL = "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName";

type MsGraphProfile = {
  id?: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

function isBuiltInLoginEnabled(nodeEnv: string): boolean {
  return process.env.ALLOW_ADMIN_LOGIN === "true" && nodeEnv !== "production";
}

function parseJsonFromEnv(name: string): unknown | null {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asTrimmedString(entry))
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeRuntimeContext(value: unknown): RuntimeContext | null {
  const objectValue = asRecord(value);
  if (!objectValue) {
    return null;
  }
  const workspaceValue = asRecord(objectValue.workspace);
  const municipalityValue = asRecord(objectValue.municipality);
  if (!workspaceValue || !municipalityValue) {
    return null;
  }

  const charterValue = asRecord(workspaceValue.charter);
  if (!charterValue) {
    return null;
  }
  const charter: RuntimeCharter = {
    authority: charterValue.authority === true,
    accountability: charterValue.accountability === true,
    boundary: charterValue.boundary === true,
    continuity: charterValue.continuity === true
  };

  const workspaceId = asTrimmedString(workspaceValue.id);
  const municipalityId = asTrimmedString(municipalityValue.id);
  if (!workspaceId || !municipalityId) {
    return null;
  }

  const workspace: RuntimeWorkspace = {
    id: workspaceId,
    charter,
    ...(asTrimmedString(workspaceValue.name) ? { name: asTrimmedString(workspaceValue.name) } : {})
  };
  const municipality: RuntimeMunicipality = {
    id: municipalityId,
    ...(asTrimmedString(municipalityValue.name) ? { name: asTrimmedString(municipalityValue.name) } : {}),
    ...(asTrimmedString(municipalityValue.state) ? { state: asTrimmedString(municipalityValue.state) } : {}),
    ...(typeof municipalityValue.population === "number" && Number.isFinite(municipalityValue.population)
      ? { population: Math.max(0, Math.floor(municipalityValue.population)) }
      : {}),
    ...(asRecord(municipalityValue.statutes) ? { statutes: municipalityValue.statutes as Record<string, string> } : {}),
    ...(asRecord(municipalityValue.policies)
      ? { policies: municipalityValue.policies as Record<string, Record<string, unknown>> }
      : {}),
    ...(asRecord(municipalityValue.risk_profile)
      ? { risk_profile: municipalityValue.risk_profile as Record<string, unknown> }
      : {})
  };

  const actionDefaultsValue = asRecord(objectValue.actionDefaults);
  const actionDefaults: RuntimeActionDefaults | undefined = actionDefaultsValue
    ? {
        ...(actionDefaultsValue.mode === "launch" || actionDefaultsValue.mode === "governed"
          ? { mode: actionDefaultsValue.mode }
          : {}),
        ...(asTrimmedString(actionDefaultsValue.intent) ? { intent: asTrimmedString(actionDefaultsValue.intent) } : {}),
        ...(Array.isArray(actionDefaultsValue.targets) ? { targets: asStringArray(actionDefaultsValue.targets) } : {}),
        ...(actionDefaultsValue.environment === "production" ||
        actionDefaultsValue.environment === "staging" ||
        actionDefaultsValue.environment === "pilot"
          ? { environment: actionDefaultsValue.environment }
          : {}),
        ...(asTrimmedString(actionDefaultsValue.description)
          ? { description: asTrimmedString(actionDefaultsValue.description) }
          : {})
      }
    : undefined;

  return {
    workspace,
    municipality,
    ...(actionDefaults ? { actionDefaults } : {})
  };
}

function normalizeLiveTiles(value: unknown): LiveTile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const tiles: LiveTile[] = [];
  for (const entry of value) {
    const objectEntry = asRecord(entry);
    if (!objectEntry) {
      continue;
    }
    const id = asTrimmedString(objectEntry.id);
    const label = asTrimmedString(objectEntry.label);
    const icon = asTrimmedString(objectEntry.icon);
    const mode = objectEntry.mode === "launch" || objectEntry.mode === "governed" ? objectEntry.mode : null;
    const intent = asTrimmedString(objectEntry.intent);
    const target = asTrimmedString(objectEntry.target);
    const tone = asTrimmedString(objectEntry.tone);
    const description = asTrimmedString(objectEntry.description);
    if (!id || !label || !icon || !mode || !intent || !target || !tone || !description) {
      continue;
    }
    const tile: LiveTile = {
      id,
      label,
      icon,
      mode,
      intent,
      target,
      tone,
      description
    };
    if (objectEntry.emergency === true) {
      tile.emergency = true;
    }
    tiles.push(tile);
  }
  return tiles;
}

function normalizeCapabilities(value: unknown): LiveCapabilities | null {
  const objectValue = asRecord(value);
  if (!objectValue) {
    return null;
  }
  const automationsValue = Array.isArray(objectValue.automations) ? objectValue.automations : [];
  const quickActionsValue = Array.isArray(objectValue.quickActions) ? objectValue.quickActions : [];

  const automations = automationsValue
    .map((entry) => {
      const objectEntry = asRecord(entry);
      if (!objectEntry) {
        return null;
      }
      const id = asTrimmedString(objectEntry.id);
      const title = asTrimmedString(objectEntry.title);
      const icon = asTrimmedString(objectEntry.icon);
      const desc = asTrimmedString(objectEntry.desc);
      const status = asTrimmedString(objectEntry.status);
      const tags = asStringArray(objectEntry.tags);
      if (!id || !title || !icon || !desc || !status) {
        return null;
      }
      return {
        type: "automation",
        id,
        title,
        icon,
        desc,
        tags,
        status,
        ...(asTrimmedString(objectEntry.modal) ? { modal: asTrimmedString(objectEntry.modal) } : {})
      } satisfies CapabilityAutomation;
    })
    .filter((entry): entry is CapabilityAutomation => Boolean(entry));

  const quickActions = quickActionsValue
    .map((entry) => {
      const objectEntry = asRecord(entry);
      if (!objectEntry) {
        return null;
      }
      const title = asTrimmedString(objectEntry.title);
      const icon = asTrimmedString(objectEntry.icon);
      const desc = asTrimmedString(objectEntry.desc);
      const hint = asTrimmedString(objectEntry.hint);
      const trigger = asStringArray(objectEntry.trigger).map((item) => item.toLowerCase());
      if (!title || !icon || !desc || !hint || trigger.length === 0) {
        return null;
      }
      return {
        type: "action",
        trigger,
        title,
        icon,
        desc,
        hint,
        ...(asTrimmedString(objectEntry.modal) ? { modal: asTrimmedString(objectEntry.modal) } : {})
      } satisfies CapabilityAction;
    })
    .filter((entry): entry is CapabilityAction => Boolean(entry));

  return { automations, quickActions };
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseLoginUsersFromEnv(): LoginUser[] {
  const raw = process.env.PJ_LOGIN_USERS_JSON;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const objectEntry = entry as Record<string, unknown>;
        const id = typeof objectEntry.id === "string" ? objectEntry.id.trim() : "";
        const username = typeof objectEntry.username === "string" ? objectEntry.username.trim() : "";
        const passwordHash = typeof objectEntry.passwordHash === "string" ? objectEntry.passwordHash.trim() : "";
        const name = typeof objectEntry.name === "string" ? objectEntry.name.trim() : "";
        const role = typeof objectEntry.role === "string" ? objectEntry.role.trim().toLowerCase() : "";
        const permissions = Array.isArray(objectEntry.permissions)
          ? objectEntry.permissions
              .map((permission) => (typeof permission === "string" ? permission.trim().toLowerCase() : ""))
              .filter(Boolean)
          : [];
        const tenants = Array.isArray(objectEntry.tenants)
          ? objectEntry.tenants
              .map((tenant) => {
                if (!tenant || typeof tenant !== "object") {
                  return null;
                }
                const tenantEntry = tenant as Record<string, unknown>;
                const tenantId = typeof tenantEntry.id === "string" ? tenantEntry.id.trim() : "";
                const tenantName = typeof tenantEntry.name === "string" ? tenantEntry.name.trim() : "";
                const tenantSha = typeof tenantEntry.sha === "string" ? tenantEntry.sha.trim() : "";
                const connections = Array.isArray(tenantEntry.connections)
                  ? tenantEntry.connections
                      .map((connection) => (typeof connection === "string" ? connection.trim() : ""))
                      .filter(Boolean)
                  : [];
                if (!tenantId || !tenantName) {
                  return null;
                }
                return {
                  id: tenantId,
                  name: tenantName,
                  sha: tenantSha,
                  connections
                };
              })
              .filter((tenant): tenant is LoginUser["tenants"][number] => Boolean(tenant))
          : [];

        if (!id || !username || !passwordHash || !name || !role) {
          return null;
        }

        return {
          id,
          username,
          passwordHash,
          name,
          role,
          permissions,
          tenants,
          tenantId: typeof objectEntry.tenantId === "string" ? objectEntry.tenantId.trim() || null : tenants[0]?.id ?? null
        } satisfies LoginUser;
      })
      .filter((entry): entry is LoginUser => Boolean(entry));
  } catch {
    return [];
  }
}

function resolveLoginUsers(): LoginUser[] {
  return parseLoginUsersFromEnv();
}

async function findUserAndValidate(
  users: LoginUser[],
  requestBody: Partial<LoginRequestBody> | null | undefined
): Promise<LoginUser | null> {
  const username = typeof requestBody?.username === "string" ? requestBody.username.trim() : "";
  const password = typeof requestBody?.password === "string" ? requestBody.password : "";
  if (!username || !password) {
    return null;
  }

  const user = users.find((candidate) => secureEqual(candidate.username, username));
  if (!user) {
    return null;
  }
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  return user;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePrincipal(value: string | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parsePrincipalSet(value: string | undefined): Set<string> {
  return new Set(parseCsv(value).map((entry) => normalizePrincipal(entry)).filter(Boolean));
}

function extractMsGraphToken(req: express.Request): string | null {
  const rawHeader = req.get(MS_GRAPH_TOKEN_HEADER);
  if (!rawHeader) {
    return null;
  }
  const trimmed = rawHeader.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

async function fetchMsGraphProfile(
  token: string,
  fetchImpl: typeof fetch
): Promise<MsGraphProfile | null> {
  const response = await fetchImpl(DEFAULT_GRAPH_PROFILE_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return payload as MsGraphProfile;
}

function buildMsGraphAuthContext(
  profile: MsGraphProfile,
  runtimeContext: RuntimeContext | null,
  nodeEnv: string
): AuthContext | null {
  const principal = normalizePrincipal(profile.userPrincipalName || profile.mail);
  const profileId = typeof profile.id === "string" ? profile.id.trim() : "";
  if (!principal && !profileId) {
    return null;
  }

  const adminPrincipals = parsePrincipalSet(process.env.PJ_GRAPH_ADMIN_PRINCIPALS);
  const deployPrincipals = parsePrincipalSet(process.env.PJ_GRAPH_DEPLOY_PRINCIPALS);
  const adminFallbackPrincipals = parsePrincipalSet(process.env.PJ_GRAPH_ADMIN_USERS);
  const deployFallbackPrincipals = parsePrincipalSet(process.env.PJ_GRAPH_DEPLOY_USERS);

  const isAdmin =
    (principal && adminPrincipals.has(principal)) ||
    (principal && adminFallbackPrincipals.has(principal));
  const explicitDeploy =
    (principal && deployPrincipals.has(principal)) ||
    (principal && deployFallbackPrincipals.has(principal));
  const canDeploy = nodeEnv === "production" ? isAdmin || explicitDeploy : true;

  const defaultWorkspaceId = runtimeContext?.workspace?.id?.trim() || "publiclogic";
  const defaultWorkspaceName = runtimeContext?.workspace?.name?.trim() || "PublicLogic";
  const defaultConnections = Array.from(
    new Set(
      (runtimeContext?.actionDefaults?.targets ?? [])
        .map((target) => String(target).split(":")[0]?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  return {
    userId: profileId || principal,
    name: (typeof profile.displayName === "string" ? profile.displayName.trim() : "") || principal || profileId,
    role: isAdmin ? "admin" : "operator",
    permissions: canDeploy ? ["deploy"] : [],
    tenants: [
      {
        id: defaultWorkspaceId,
        name: defaultWorkspaceName,
        sha: "",
        connections: defaultConnections
      }
    ],
    tenantId: defaultWorkspaceId,
    delegations: []
  };
}

function parseEnvPositiveInt(value: string | undefined): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeTrustedOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function resolveTrustedParentOrigins(nodeEnv: string): string[] {
  const configured = parseCsv(process.env.PJ_ALLOWED_PARENT_ORIGINS)
    .map((value) => normalizeTrustedOrigin(value))
    .filter((value): value is string => Boolean(value));

  const defaults =
    nodeEnv === "production"
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"];

  const normalizedDefaults = defaults
    .map((value) => normalizeTrustedOrigin(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set([...configured, ...normalizedDefaults]));
}

function resolveCorsAllowedOrigins(nodeEnv: string): string[] {
  const configured = parseCsv(process.env.CORS_ALLOWED_ORIGINS)
    .map((value) => normalizeTrustedOrigin(value))
    .filter((value): value is string => Boolean(value));

  const defaults =
    nodeEnv === "production"
      ? []
      : [
          "http://localhost:3000",
          "https://localhost:3000",
          "http://127.0.0.1:3000",
          "https://127.0.0.1:3000",
          "http://localhost:3002",
          "https://localhost:3002",
          "http://127.0.0.1:3002",
          "https://127.0.0.1:3002"
        ];

  const normalizedDefaults = defaults
    .map((value) => normalizeTrustedOrigin(value))
    .filter((value): value is string => Boolean(value));

  const trustedParentOrigins = resolveTrustedParentOrigins(nodeEnv);
  return Array.from(new Set([...configured, ...normalizedDefaults, ...trustedParentOrigins]));
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function readPjWorkspaceSource(): string {
  let lastError: Error | null = null;
  for (const candidate of PJ_WORKSPACE_CANDIDATE_PATHS) {
    try {
      return fs.readFileSync(candidate, "utf8");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
        continue;
      }
      throw err;
    }
  }
  const inspected = PJ_WORKSPACE_CANDIDATE_PATHS.join(", ");
  const details = lastError ? ` (last error: ${lastError.message})` : "";
  throw new Error(`PuddleJumper workspace HTML not found. Checked paths: ${inspected}${details}`);
}

function buildConnectSrcDirective(trustedParentOrigins: string[], includeParentOrigins: boolean): string {
  if (!includeParentOrigins || trustedParentOrigins.length === 0) {
    return "connect-src 'self'";
  }
  const sources = Array.from(new Set(["'self'", ...trustedParentOrigins]));
  return `connect-src ${sources.join(" ")}`;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPjWorkspaceHtml(trustedParentOrigins: string[]): string {
  let source = readPjWorkspaceSource();
  const inlineHashes = resolvePjInlineCspHashes();
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
      `script-src 'sha256-${inlineHashes.scriptHash}'`
    ].join("; ");
    source = source.replace(
      /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
      `<meta http-equiv="Content-Security-Policy" content="${inlineMetaCsp}">`
    );
  }
  const trustedValue = escapeHtmlAttribute(trustedParentOrigins.join(","));
  const marker = '<meta name="pj-trusted-parent-origins" content="">';
  if (!source.includes(marker)) {
    return source;
  }
  return source.replace(marker, `<meta name="pj-trusted-parent-origins" content="${trustedValue}">`);
}

function extractInlineTagContent(source: string, tag: "script" | "style"): string | null {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = source.match(pattern);
  if (!match || typeof match[1] !== "string") {
    return null;
  }
  return match[1];
}

function resolvePjInlineCspHashes(): { scriptHash: string | null; styleHash: string | null } {
  try {
    const source = readPjWorkspaceSource();
    const scriptContent = extractInlineTagContent(source, "script");
    const styleContent = extractInlineTagContent(source, "style");
    const scriptHash = scriptContent ? crypto.createHash("sha256").update(scriptContent, "utf8").digest("base64") : null;
    const styleHash = styleContent ? crypto.createHash("sha256").update(styleContent, "utf8").digest("base64") : null;
    return { scriptHash, styleHash };
  } catch {
    return { scriptHash: null, styleHash: null };
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function summarizePrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > 300 ? `${normalized.slice(0, 300)}…` : normalized;
}

function normalizeCorrelationId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!CORRELATION_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function withCorrelationId(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const incoming = normalizeCorrelationId(req.get(CORRELATION_ID_HEADER));
  const correlationId = incoming ?? crypto.randomUUID();
  res.locals.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);
  next();
}

function getCorrelationId(res: express.Response): string {
  const fromLocals = typeof res.locals?.correlationId === "string" ? res.locals.correlationId : "";
  return fromLocals || crypto.randomUUID();
}

function logServerError(scope: string, correlationId: string, error: unknown): void {
  const serialized = {
    level: "error",
    scope,
    correlationId,
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unhandled server error",
    timestamp: new Date().toISOString()
  };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(serialized));
}

function logServerInfo(scope: string, correlationId: string, details: Record<string, unknown>): void {
  const serialized = {
    level: "info",
    scope,
    correlationId,
    timestamp: new Date().toISOString(),
    ...details
  };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(serialized));
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function computeAccessNotificationBackoffMs(retryCount: number): number {
  const baseMs = 30_000;
  const exponent = Math.max(0, retryCount - 1);
  return Math.min(60 * 60 * 1000, baseMs * 2 ** exponent);
}

type AccessNotificationWorkerOptions = {
  prrStore: PrrStore;
  webhookUrl: string;
  fetchImpl: typeof fetch;
  batchSize: number;
  maxRetries: number;
};

export async function processAccessNotificationQueueOnce(options: AccessNotificationWorkerOptions): Promise<void> {
  const claimed = options.prrStore.claimPendingAccessRequestNotifications(options.batchSize);
  if (claimed.length === 0) {
    return;
  }

  for (const notification of claimed) {
    const correlationId = crypto.randomUUID();
    try {
      let payload: Record<string, unknown> = {};
      try {
        payload =
          typeof notification.payload_json === "string" && notification.payload_json.trim()
            ? (JSON.parse(notification.payload_json) as Record<string, unknown>)
            : {};
      } catch {
        payload = { raw_payload: notification.payload_json };
      }

      const response = await options.fetchImpl(options.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-correlation-id": correlationId
        },
        body: JSON.stringify({
          event: "access_request_notification",
          notification_id: notification.id,
          target: notification.target_email,
          tenant_id: notification.tenant_id,
          access_request_id: notification.access_request_id,
          correlation_id: correlationId,
          payload
        })
      });

      const responseBody = truncateText(await response.text(), 2_000);
      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${responseBody || "empty response"}`);
      }

      options.prrStore.markAccessRequestNotificationDelivered({
        notificationId: notification.id,
        deliveredAt: new Date().toISOString(),
        responseSummary: JSON.stringify({
          status: response.status,
          body: responseBody
        })
      });
    } catch (error) {
      const retryCount = Number.isFinite(notification.retry_count) ? notification.retry_count : 1;
      const shouldFail = retryCount >= options.maxRetries;
      const nextAttemptAt = shouldFail
        ? null
        : new Date(Date.now() + computeAccessNotificationBackoffMs(retryCount)).toISOString();
      const message = truncateText(
        error instanceof Error ? error.message : "Unknown notification delivery error",
        1_000
      );
      options.prrStore.markAccessRequestNotificationRetry({
        notificationId: notification.id,
        status: shouldFail ? "failed" : "retry",
        nextAttemptAt,
        errorMessage: message
      });
      logServerError("access-notification-worker", correlationId, error);
    }
  }
}

function buildCapabilityManifest(
  auth: AuthContext,
  runtimeTiles: LiveTile[],
  runtimeCapabilities: LiveCapabilities | null
): CapabilityManifest {
  const canEvaluate = auth.permissions.includes("deploy");
  const canEditCorePrompt = auth.role === "admin";
  const hasTiles = runtimeTiles.length > 0;
  const hasCapabilities =
    runtimeCapabilities !== null &&
    (runtimeCapabilities.automations.length > 0 || runtimeCapabilities.quickActions.length > 0);

  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    capabilities: {
      "corePrompt.read": true,
      "corePrompt.edit": canEditCorePrompt,
      "evaluate.execute": canEvaluate,
      "missionControl.tiles.read": hasTiles,
      "missionControl.tiles.customize": hasTiles && canEvaluate,
      "missionControl.capabilities.read": hasCapabilities,
      "popout.launch": hasCapabilities
    }
  };
}

function isPjActionAllowed(manifest: CapabilityManifest, action: PjActionDefinition): boolean {
  return action.requires.every((capabilityKey) => manifest.capabilities[capabilityKey] === true);
}

function listAllowedPjActions(manifest: CapabilityManifest): Array<{ id: PjActionId; label: string; requires: string[] }> {
  return PJ_ACTION_DEFINITIONS
    .filter((action) => isPjActionAllowed(manifest, action))
    .map((action) => ({
      id: action.id,
      label: action.label,
      requires: [...action.requires]
    }));
}

function resolvePrimaryScope(auth: AuthContext, runtimeContext: RuntimeContext): string {
  const fromTenantId = auth.tenantId?.trim();
  if (fromTenantId) {
    return fromTenantId;
  }
  const fromTenants = auth.tenants.find((tenant: any) => tenant.id.trim())?.id.trim();
  if (fromTenants) {
    return fromTenants;
  }
  return runtimeContext.workspace.id;
}

function resolveStatuteCitation(runtimeContext: RuntimeContext): string {
  const statutes = runtimeContext.municipality.statutes;
  if (statutes && typeof statutes === "object") {
    const first = Object.values(statutes).find((value) => typeof value === "string" && value.trim().length > 0);
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
  }
  return "MGL Ch. 66 Section 10";
}

function normalizeTargetSegment(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._:-]+/g, "-");
  return normalized || "default";
}

function buildPjEvaluatePayload(
  auth: AuthContext,
  runtimeContext: RuntimeContext,
  request: PjExecuteRequestBody,
  correlationId: string
): EvaluateRequestBody {
  const scope = resolvePrimaryScope(auth, runtimeContext);
  const timestamp = new Date().toISOString();
  const dateStamp = timestamp.slice(0, 10);
  const statuteCitation = resolveStatuteCitation(runtimeContext);
  const policyKey = "governance.control_surface";
  const requestIdFromPayload =
    (typeof request.payload === "object" && request.payload && "requestId" in request.payload
      ? (request.payload as { requestId?: string }).requestId
      : undefined) ?? undefined;
  const rawRequestId = request.requestId?.trim() || requestIdFromPayload?.trim();
  const scopedId = scopedRequestId(auth.userId, auth.tenantId, rawRequestId);
  const trigger = {
    type: "manual" as const,
    reference: `pj:${request.actionId}:${correlationId}`,
    evidence: {
      statute: statuteCitation,
      policyKey
    }
  };

  if (request.actionId === "environment.create") {
    const segment = normalizeTargetSegment(request.payload.name);
    return {
      workspace: {
        ...runtimeContext.workspace,
        id: scope
      },
      municipality: runtimeContext.municipality,
      operator: {
        id: auth.userId,
        name: auth.name,
        role: auth.role,
        permissions: auth.permissions,
        delegations: auth.delegations
      },
      action: {
        mode: "governed",
        trigger,
        intent: "create_environment",
        targets: [`sharepoint:${scope}:/environments/${segment}`],
        environment: "production",
        metadata: {
          description: `Create environment ${request.payload.name} via PuddleJumper control surface.`,
          archieve: {
            dept: "PJ",
            type: "policy",
            date: dateStamp,
            seq: 1,
            v: 1
          }
        },
        ...(scopedId ? { requestId: scopedId } : {})
      },
      timestamp
    };
  }

  if (request.actionId === "environment.update") {
    const environmentId = normalizeTargetSegment(request.payload.environmentId);
    return {
      workspace: {
        ...runtimeContext.workspace,
        id: scope
      },
      municipality: runtimeContext.municipality,
      operator: {
        id: auth.userId,
        name: auth.name,
        role: auth.role,
        permissions: auth.permissions,
        delegations: auth.delegations
      },
      action: {
        mode: "governed",
        trigger,
        intent: "deploy_policy",
        targets: [`sharepoint:${scope}:/environments/${environmentId}`],
        environment: "production",
        metadata: {
          description: `Update environment ${request.payload.environmentId} via PuddleJumper control surface.`,
          archieve: {
            dept: "PJ",
            type: "policy",
            date: dateStamp,
            seq: 1,
            v: 1
          }
        },
        ...(scopedId ? { requestId: scopedId } : {})
      },
      timestamp
    };
  }

  if (request.actionId === "environment.promote") {
    const source = normalizeTargetSegment(request.payload.sourceEnvironmentId);
    const target = normalizeTargetSegment(request.payload.targetEnvironmentId);
    return {
      workspace: {
        ...runtimeContext.workspace,
        id: scope
      },
      municipality: runtimeContext.municipality,
      operator: {
        id: auth.userId,
        name: auth.name,
        role: auth.role,
        permissions: auth.permissions,
        delegations: auth.delegations
      },
      action: {
        mode: "governed",
        trigger,
        intent: "deploy_policy",
        targets: [`sharepoint:${scope}:/environments/promotions/${source}/${target}`],
        environment: "production",
        metadata: {
          description: `Promote environment ${request.payload.sourceEnvironmentId} to ${request.payload.targetEnvironmentId} via PuddleJumper.`,
          archieve: {
            dept: "PJ",
            type: "policy",
            date: dateStamp,
            seq: 1,
            v: 1
          }
        },
        ...(scopedId ? { requestId: scopedId } : {})
      },
      timestamp
    };
  }

  const snapshotEnvironmentId = normalizeTargetSegment(request.payload.environmentId);
  return {
    workspace: {
      ...runtimeContext.workspace,
      id: scope
    },
    municipality: runtimeContext.municipality,
    operator: {
      id: auth.userId,
      name: auth.name,
      role: auth.role,
      permissions: auth.permissions,
      delegations: auth.delegations
    },
    action: {
      mode: "governed",
      trigger,
      intent: "deploy_policy",
      targets: [`sharepoint:${scope}:/environments/snapshots/${snapshotEnvironmentId}`],
      environment: "production",
      metadata: {
        description: `Snapshot environment ${request.payload.environmentId} via PuddleJumper control surface.`,
        archieve: {
          dept: "PJ",
          type: "audit",
          date: dateStamp,
          seq: 1,
          v: 1
        }
      },
      ...(scopedId ? { requestId: scopedId } : {})
    },
    timestamp
  };
}

function resolveDecisionStatusCode(result: { approved: boolean; warnings: string[] }): number {
  if (result.approved) {
    return 200;
  }
  if (result.warnings.some((warning) => /idempotency conflict|schema version mismatch/i.test(warning))) {
    return 409;
  }
  if (result.warnings.some((warning) => /invalid canonical source|canonical/i.test(warning))) {
    return 400;
  }
  return 400;
}

function buildPjExecuteData(
  request: PjExecuteRequestBody,
  evaluatePayload: EvaluateRequestBody,
  decision: DecisionResult
): Record<string, unknown> {
  const base = {
    actionId: request.actionId,
    mode: request.mode,
    decision
  };

  if (request.mode === "dry-run") {
    return {
      ...base,
      preview: {
        workspaceId: evaluatePayload.workspace.id,
        intent: evaluatePayload.action.intent,
        targets: evaluatePayload.action.targets,
        description: evaluatePayload.action.metadata.description
      }
    };
  }

  if (request.actionId === "environment.create") {
    return {
      ...base,
      id: `env-${decision.auditRecord.eventId.slice(0, 12)}`,
      name: request.payload.name,
      version: 1,
      config: request.payload.config ?? {},
      createdAt: decision.auditRecord.timestamp,
      updatedAt: decision.auditRecord.timestamp
    };
  }

  if (request.actionId === "environment.update") {
    return {
      ...base,
      environmentId: request.payload.environmentId,
      patch: request.payload.patch
    };
  }

  if (request.actionId === "environment.promote") {
    return {
      ...base,
      sourceEnvironmentId: request.payload.sourceEnvironmentId,
      targetEnvironmentId: request.payload.targetEnvironmentId,
      merge: Boolean(request.payload.merge)
    };
  }

  return {
    ...base,
    environmentId: request.payload.environmentId,
    message: request.payload.message ?? ""
  };
}

function createSecurityHeadersMiddleware(nodeEnv: string) {
  const trustedParentOrigins = resolveTrustedParentOrigins(nodeEnv);
  const frameAncestors = ["'self'", ...trustedParentOrigins].join(" ");
  const allowCrossOriginEmbedding = trustedParentOrigins.length > 0;
  const inlinePjPaths = new Set([
    "/pj",
    "/puddle-jumper",
    "/pj-workspace",
    "/puddlejumper-master-environment-control.html"
  ]);
  const trustedConnectPaths = new Set([
    "/pj",
    "/puddle-jumper",
    "/pj-workspace",
    "/puddlejumper-master-environment-control.html",
    "/pj-popout.html"
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
    const inlineHashes = allowsInlineAssets ? resolvePjInlineCspHashes() : { scriptHash: null, styleHash: null };
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
        "default-src 'self'",
        scriptSrc,
        styleSrc,
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        connectSrc,
        "object-src 'none'",
        "base-uri 'none'",
        `frame-ancestors ${frameAncestors}`
      ].join("; ")
    );
    next();
  };
}

function createCorsMiddleware(nodeEnv: string) {
  const allowedOrigins = new Set(resolveCorsAllowedOrigins(nodeEnv));
  const defaultAllowHeaders = [
    "Authorization",
    "Content-Type",
    "X-MS-Graph-Token",
    "X-PuddleJumper-Request",
    "X-Correlation-Id"
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

function scopedRequestId(userId: string, tenantId: string | null, requestId: string | undefined): string | undefined {
  if (!requestId) {
    return undefined;
  }
  const normalizedTenant = tenantId && tenantId.trim() ? tenantId.trim() : "no-tenant";
  return `${userId}:${normalizedTenant}:${requestId}`;
}

function normalizeScopeToken(value: string): string {
  return value.trim().toLowerCase();
}

function extractTargetScopeToken(target: string): string | null {
  const rawTarget = target.trim();
  if (!rawTarget) {
    return null;
  }
  if (rawTarget.startsWith("health:")) {
    return "__internal__";
  }

  if (!rawTarget.includes(":")) {
    const [owner = ""] = rawTarget.split("/");
    return owner ? normalizeScopeToken(owner) : null;
  }

  const [connector = "", rest = ""] = rawTarget.split(":", 2);
  if (!rest) {
    return null;
  }
  if (connector.toLowerCase() === "github") {
    const [owner = ""] = rest.split("/");
    return owner ? normalizeScopeToken(owner) : null;
  }
  const [scope = ""] = rest.split(":");
  return scope ? normalizeScopeToken(scope) : null;
}

function assertTenantScope(auth: AuthContext, payload: EvaluateRequestBody):
  | { ok: true }
  | { ok: false; reason: string; details: Record<string, unknown> } {
  const authorizedScopes = new Set<string>();
  if (auth.tenantId) {
    authorizedScopes.add(normalizeScopeToken(auth.tenantId));
  }
  for (const tenant of auth.tenants) {
    if (tenant.id) {
      authorizedScopes.add(normalizeScopeToken(tenant.id));
    }
    if (tenant.name) {
      authorizedScopes.add(normalizeScopeToken(tenant.name));
    }
    if (tenant.sha) {
      authorizedScopes.add(normalizeScopeToken(tenant.sha));
    }
  }

  if (authorizedScopes.size === 0) {
    return {
      ok: false,
      reason: "Tenant scope unavailable",
      details: { userId: auth.userId }
    };
  }

  const workspaceScope = normalizeScopeToken(payload.workspace.id);
  if (!authorizedScopes.has(workspaceScope)) {
    return {
      ok: false,
      reason: "Workspace outside authorized tenant scope",
      details: { workspaceId: payload.workspace.id, tenantId: auth.tenantId, authorizedScopes: Array.from(authorizedScopes) }
    };
  }

  const unauthorizedTargets = payload.action.targets.filter((target) => {
    const token = extractTargetScopeToken(target);
    if (!token) {
      return true;
    }
    if (token === "__internal__") {
      return false;
    }
    return !authorizedScopes.has(token);
  });
  if (unauthorizedTargets.length > 0) {
    return {
      ok: false,
      reason: "One or more targets are outside authorized tenant scope",
      details: {
        unauthorizedTargets,
        tenantId: auth.tenantId,
        authorizedScopes: Array.from(authorizedScopes)
      }
    };
  }

  return { ok: true };
}

function resolveRuntimeContext(nodeEnv: string): RuntimeContext | null {
  const context = normalizeRuntimeContext(parseJsonFromEnv("PJ_RUNTIME_CONTEXT_JSON"));
  if (context) {
    return context;
  }
  if (nodeEnv === "production") {
    throw new Error("PJ_RUNTIME_CONTEXT_JSON must be configured in production");
  }
  return null;
}

function resolveLiveTiles(nodeEnv: string): LiveTile[] {
  const tiles = normalizeLiveTiles(parseJsonFromEnv("PJ_RUNTIME_TILES_JSON"));
  if (tiles.length > 0) {
    return tiles;
  }
  if (nodeEnv === "production") {
    throw new Error("PJ_RUNTIME_TILES_JSON must be configured in production");
  }
  return [];
}

function resolveLiveCapabilities(nodeEnv: string): LiveCapabilities | null {
  const capabilities = normalizeCapabilities(parseJsonFromEnv("PJ_RUNTIME_CAPABILITIES_JSON"));
  if (capabilities && (capabilities.automations.length > 0 || capabilities.quickActions.length > 0)) {
    return capabilities;
  }
  if (nodeEnv === "production") {
    throw new Error("PJ_RUNTIME_CAPABILITIES_JSON must be configured in production");
  }
  return null;
}

function resolvePathFromEnv(name: string, fallbackAbsolutePath: string): string {
  const rawValue = process.env[name];
  const trimmed = rawValue?.trim();
  const value = trimmed && trimmed.length > 0 ? trimmed : fallbackAbsolutePath;
  return path.resolve(value);
}

function resolveInsideControlledDir(baseDir: string, candidate: string): string {
  const base = path.resolve(baseDir.trim());
  const target = path.resolve(candidate.trim());

  if (!target.startsWith(base + path.sep) && target !== base) {
    throw new Error("Path must be inside controlled data directory");
  }

  return target;
}

function resolveControlledDataDir(nodeEnv: string): string {
  const rawEnv = (process.env.CONTROLLED_DATA_DIR ?? "").trim();
  const fallback = nodeEnv === "production" ? "/data" : path.join(ROOT_DIR, "data");
  return path.resolve(rawEnv || fallback);
}

function assertProductionInvariants(nodeEnv: string, authOptions: AuthOptions): void {
  if (nodeEnv !== "production") {
    return;
  }
  if (process.env.ALLOW_ADMIN_LOGIN === "true") {
    throw new Error("ALLOW_ADMIN_LOGIN must not be true in production");
  }

  const controlledDataDir = resolveControlledDataDir(nodeEnv);
  const defaultPrrDbPath = path.join(controlledDataDir, "prr.db");
  const defaultIdempotencyDbPath = path.join(controlledDataDir, "idempotency.db");
  const defaultRateLimitDbPath = path.join(controlledDataDir, "rate-limit.db");
  const defaultConnectorDbPath = path.join(controlledDataDir, "connectors.db");

  const requiredEnvVars = [
    "PJ_RUNTIME_CONTEXT_JSON",
    "PJ_RUNTIME_TILES_JSON",
    "PJ_RUNTIME_CAPABILITIES_JSON",
    "PRR_DB_PATH",
    "IDEMPOTENCY_DB_PATH",
    "RATE_LIMIT_DB_PATH",
    "ACCESS_NOTIFICATION_WEBHOOK_URL"
  ];
  for (const variable of requiredEnvVars) {
    if (!process.env[variable]?.trim()) {
      throw new Error(`${variable} must be configured in production`);
    }
  }

  const hasJwtVerificationKey = Boolean(authOptions.jwtPublicKey?.trim() || authOptions.jwtSecret?.trim());
  if (!hasJwtVerificationKey) {
    throw new Error("JWT verification key must be configured in production");
  }

  if (authOptions.jwtSecret?.trim() === "dev-secret") {
    throw new Error("JWT secret cannot use development fallback in production");
  }

  const connectorStateSecret = (process.env.CONNECTOR_STATE_SECRET ?? "").trim();

  try {
    const resolved = resolvePathFromEnv("PRR_DB_PATH", defaultPrrDbPath);
    // eslint-disable-next-line no-console
    console.log("[invariant-debug] PRR_DB_PATH raw env:", JSON.stringify(process.env.PRR_DB_PATH));
    // eslint-disable-next-line no-console
    console.log("[invariant-debug] PRR_DB_PATH resolved:", resolved, "base:", controlledDataDir);
    resolveInsideControlledDir(controlledDataDir, resolved);
  } catch {
    throw new Error("PRR_DB_PATH must be inside the controlled data directory");
  }

  try {
    const resolved = resolvePathFromEnv("IDEMPOTENCY_DB_PATH", defaultIdempotencyDbPath);
    // eslint-disable-next-line no-console
    console.log("[invariant-debug] IDEMPOTENCY_DB_PATH raw env:", JSON.stringify(process.env.IDEMPOTENCY_DB_PATH));
    // eslint-disable-next-line no-console
    console.log("[invariant-debug] IDEMPOTENCY_DB_PATH resolved:", resolved, "base:", controlledDataDir);
    resolveInsideControlledDir(controlledDataDir, resolved);
  } catch {
    throw new Error("IDEMPOTENCY_DB_PATH must be inside the controlled data directory");
  }

  try {
    const resolved = resolvePathFromEnv("RATE_LIMIT_DB_PATH", defaultRateLimitDbPath);
    // eslint-disable-next-line no-console
    console.log("[invariant-debug] RATE_LIMIT_DB_PATH raw env:", JSON.stringify(process.env.RATE_LIMIT_DB_PATH));
    // eslint-disable-next-line no-console
    console.log("[invariant-debug] RATE_LIMIT_DB_PATH resolved:", resolved, "base:", controlledDataDir);
    resolveInsideControlledDir(controlledDataDir, resolved);
  } catch {
    throw new Error("RATE_LIMIT_DB_PATH must be inside the controlled data directory");
  }

  try {
    const resolved = resolvePathFromEnv("CONNECTOR_DB_PATH", defaultConnectorDbPath);
    // eslint-disable-next-line no-console
    console.log("[invariant-debug] CONNECTOR_DB_PATH raw env:", JSON.stringify(process.env.CONNECTOR_DB_PATH));
    // eslint-disable-next-line no-console
    console.log("[invariant-debug] CONNECTOR_DB_PATH resolved:", resolved, "base:", controlledDataDir);
    resolveInsideControlledDir(controlledDataDir, resolved);
  } catch {
    throw new Error("CONNECTOR_DB_PATH must be inside the controlled data directory");
  }

  if (!connectorStateSecret) {
    throw new Error("CONNECTOR_STATE_SECRET is required in production");
  }
}

export function createApp(
  nodeEnv: string = process.env.NODE_ENV ?? "development",
  options: CreateAppOptions = {}
): Express {
  const authOptions = resolveAuthOptions(options.authOptions);
  assertProductionInvariants(nodeEnv, authOptions);
  const controlledDataDir = resolveControlledDataDir(nodeEnv);
  const defaultPrrDbPath = path.join(controlledDataDir, "prr.db");
  const defaultConnectorDbPath = path.join(controlledDataDir, "connectors.db");
  let prrDbPath: string;
  try {
    prrDbPath = resolveInsideControlledDir(
      controlledDataDir,
      resolvePathFromEnv("PRR_DB_PATH", defaultPrrDbPath)
    );
  } catch {
    throw new Error("PRR_DB_PATH must be inside the controlled data directory");
  }

  let connectorDbPath: string;
  try {
    connectorDbPath = resolveInsideControlledDir(
      controlledDataDir,
      resolvePathFromEnv("CONNECTOR_DB_PATH", defaultConnectorDbPath)
    );
  } catch {
    throw new Error("CONNECTOR_DB_PATH must be inside the controlled data directory");
  }

  const connectorStateSecret =
    (process.env.CONNECTOR_STATE_SECRET ?? "").trim() ||
    (nodeEnv === "production" ? "" : "dev-connector-state-secret");
  if (!connectorStateSecret) {
    throw new Error("CONNECTOR_STATE_SECRET is required");
  }
  const app = express();
  // auth callback to set shared cookie after token exchange with Logic Commons
  app.get('/auth/callback', authCallback);
  const engine = createDefaultEngine({ canonicalSourceOptions: options.canonicalSourceOptions });
  const prrStore = new PrrStore(prrDbPath, controlledDataDir);
  const connectorStore = new ConnectorStore(connectorDbPath);
  const authMiddleware = createJwtAuthenticationMiddleware(authOptions);
  const optionalAuthMiddleware = createOptionalJwtAuthenticationMiddleware(authOptions);
  const runtimeContext = resolveRuntimeContext(nodeEnv);
  const runtimeTiles = resolveLiveTiles(nodeEnv);
  const runtimeCapabilities = resolveLiveCapabilities(nodeEnv);
  const trustedParentOrigins = resolveTrustedParentOrigins(nodeEnv);
  const msGraphFetchImpl = options.msGraphFetchImpl ?? fetch;
  const msGraphTokenExchangeEnabled =
    process.env.ALLOW_PJ_GRAPH_TOKEN_EXCHANGE === "true" || nodeEnv !== "production";
  const loginUsers = resolveLoginUsers();
  const builtInLoginEnabled = isBuiltInLoginEnabled(nodeEnv);
  const accessNotificationWebhookUrl = (process.env.ACCESS_NOTIFICATION_WEBHOOK_URL ?? "").trim();
  const configuredWorkerInterval = parseEnvPositiveInt(process.env.ACCESS_NOTIFICATION_WORKER_INTERVAL_MS);
  const configuredWorkerBatch = parseEnvPositiveInt(process.env.ACCESS_NOTIFICATION_WORKER_BATCH_SIZE);
  const configuredWorkerMaxRetries = parseEnvPositiveInt(process.env.ACCESS_NOTIFICATION_WORKER_MAX_RETRIES);
  const accessNotificationWorkerIntervalMs = Math.max(
    5_000,
    options.accessNotificationWorker?.intervalMs ??
      configuredWorkerInterval ??
      DEFAULT_ACCESS_NOTIFICATION_INTERVAL_MS
  );
  const accessNotificationBatchSize = Math.max(
    1,
    Math.min(
      100,
      options.accessNotificationWorker?.batchSize ??
        configuredWorkerBatch ??
        DEFAULT_ACCESS_NOTIFICATION_BATCH_SIZE
    )
  );
  const accessNotificationMaxRetries = Math.max(
    1,
    Math.min(
      50,
      options.accessNotificationWorker?.maxRetries ??
        configuredWorkerMaxRetries ??
        DEFAULT_ACCESS_NOTIFICATION_MAX_RETRIES
    )
  );

  const loginRateLimit = createRateLimit({
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_MAX_ATTEMPTS,
    keyGenerator: (req) => {
      const username =
        req.body && typeof req.body === "object" && "username" in req.body && typeof req.body.username === "string"
          ? req.body.username.trim().toLowerCase()
          : "anonymous";
      return `tenant:public:user:${username.slice(0, 64)}:route:/api/login:ip:${req.ip}`;
    }
  });
  const promptRateLimit = createRateLimit({
    windowMs: 60_000,
    max: 20,
    keyGenerator: (req) => {
      const auth = getAuthContext(req);
      return `tenant:${auth?.tenantId ?? "no-tenant"}:user:${auth?.userId ?? "anonymous"}:route:/api/prompt`;
    }
  });
  const evaluateRateLimit = createRateLimit({
    windowMs: 60_000,
    max: 60,
    keyGenerator: (req) => {
      const auth = getAuthContext(req);
      return `tenant:${auth?.tenantId ?? "no-tenant"}:user:${auth?.userId ?? "anonymous"}:route:/api/evaluate`;
    }
  });
  const pjExecuteRateLimit = createRateLimit({
    windowMs: 60_000,
    max: 60,
    keyGenerator: (req) => {
      const auth = getAuthContext(req);
      return `tenant:${auth?.tenantId ?? "no-tenant"}:user:${auth?.userId ?? "anonymous"}:route:/api/pj/execute`;
    }
  });

  app.use(withCorrelationId);
  app.use(createCorsMiddleware(nodeEnv));
  app.use(createSecurityHeadersMiddleware(nodeEnv));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(express.static(PUBLIC_DIR));
  app.use("/internal-src", express.static(INTERNAL_SRC_DIR));
  app.use("/api/public", createPublicPrrRouter(prrStore));

  const accessNotificationWorkerDisabled = options.accessNotificationWorker?.disable === true;
  const accessNotificationFetchImpl = options.accessNotificationWorker?.fetchImpl ?? fetch;
  if (!accessNotificationWorkerDisabled && accessNotificationWebhookUrl) {
    const runAccessNotificationWorker = async (): Promise<void> => {
      try {
        await processAccessNotificationQueueOnce({
          prrStore,
          webhookUrl: accessNotificationWebhookUrl,
          fetchImpl: accessNotificationFetchImpl,
          batchSize: accessNotificationBatchSize,
          maxRetries: accessNotificationMaxRetries
        });
      } catch (error) {
        logServerError("access-notification-worker-loop", crypto.randomUUID(), error);
      }
    };
    void runAccessNotificationWorker();
    const workerInterval = setInterval(() => {
      void runAccessNotificationWorker();
    }, accessNotificationWorkerIntervalMs);
    workerInterval.unref?.();
  }

  const sendPjWorkspace = (res: express.Response): void => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.type("html").send(renderPjWorkspaceHtml(trustedParentOrigins));
  };

  app.get("/pj", (_req, res) => {
    sendPjWorkspace(res);
  });
  app.get("/puddle-jumper", (_req, res) => {
    sendPjWorkspace(res);
  });
  app.get("/pj-workspace", (_req, res) => {
    sendPjWorkspace(res);
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "puddle-jumper-deploy-remote",
      systemPromptVersion: engine.systemPromptVersion,
      nodeEnv,
      now: new Date().toISOString()
    });
  });

  app.post("/api/login", loginRateLimit, async (req, res) => {
    if (!builtInLoginEnabled) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    if (loginUsers.length === 0) {
      res.status(503).json({ error: "Login unavailable" });
      return;
    }

    const parsedLogin = loginRequestSchema.safeParse(req.body);
    if (!parsedLogin.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsedLogin.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const user = await findUserAndValidate(loginUsers, parsedLogin.data);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = await signJwt(
      {
        sub: user.id,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        tenants: user.tenants,
        tenantId: user.tenantId ?? undefined,
        delegations: []
      },
      { expiresIn: '8h' }
    );

    setJwtCookieOnResponse(res, token, { maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000), sameSite: 'lax' });
    res.status(200).json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });
  });

  app.use("/api", (req, res, next) => {
    if (req.method === "POST" && req.path === "/login") {
      next();
      return;
    }
    if (req.method === "POST" && req.path === "/prr/intake") {
      optionalAuthMiddleware(req, res, next);
      return;
    }
    if (req.method === "POST" && req.path === "/access/request") {
      optionalAuthMiddleware(req, res, next);
      return;
    }
    if (req.method === "GET" && /^\/connectors\/(?:microsoft|google|github)\/auth\/callback$/.test(req.path)) {
      optionalAuthMiddleware(req, res, next);
      return;
    }
    if (req.method === "GET" && req.path === "/pj/identity-token") {
      optionalAuthMiddleware(req, res, next);
      return;
    }
    authMiddleware(req, res, next);
  });

  app.use("/api", (req, res, next) => {
    if (req.method === "GET") {
      next();
      return;
    }
    csrfProtection(req, res, next);
  });

  app.post("/api/logout", requireAuthenticated(), (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: nodeEnv === "production",
      sameSite: "lax",
      path: "/"
    });
    res.status(200).json({ ok: true });
  });

  app.get("/api/sample", requireAuthenticated(), (_req, res) => {
    res.status(404).json({ error: "Not available" });
  });

  app.use(
    "/api/connectors",
    createConnectorsRouter({
      store: connectorStore,
      stateHmacKey: connectorStateSecret
    })
  );

  app.post("/api/prr/intake", (req, res) => {
    const parsed = prrIntakeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const auth = getAuthContext(req);
    const tenantId = auth?.tenantId ?? (typeof parsed.data.tenantId === "string" ? parsed.data.tenantId.trim() : "");
    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    const actorUserId = auth?.userId ?? "public";
    const created = prrStore.intake({
      tenantId,
      requesterName: parsed.data.requester_name ?? null,
      requesterEmail: parsed.data.requester_email ?? null,
      subject: parsed.data.subject,
      description: parsed.data.description ?? null,
      actorUserId,
      metadata: { source: "api.prr.intake" }
    });
    const publicBase = (process.env.PJ_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
    const trackingPath = `/api/public/prrs/${created.public_id}`;
    const trackingUrl = publicBase ? `${publicBase}${trackingPath}` : trackingPath;
    res.status(201).json({
      id: created.id,
      tenantId: created.tenantId,
      received_at: created.received_at,
      statutory_due_at: created.statutory_due_at,
      status: created.status,
      public_id: created.public_id,
      tracking_url: trackingUrl
    });
  });

  app.get("/api/prr", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!auth.tenantId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const statusParsed = statusRaw ? prrStatusSchema.safeParse(statusRaw) : undefined;
    if (statusRaw && !statusParsed?.success) {
      res.status(400).json({ error: "Invalid status filter" });
      return;
    }
    const assignedTo = typeof req.query.assigned_to === "string" ? req.query.assigned_to.trim() : undefined;
    const pageRaw = typeof req.query.page === "string" ? Number.parseInt(req.query.page, 10) : 1;
    const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 50;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

    const result = prrStore.listForTenant({
      tenantId: auth.tenantId,
      status: statusParsed?.success ? (statusParsed.data as PrrStatus) : undefined,
      assignedTo: assignedTo || undefined,
      page,
      limit
    });
    res.json(result);
  });

  app.post("/api/prr/:id/status", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!auth.tenantId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const prrId = String(req.params.id ?? "").trim();
    if (!prrId) {
      res.status(400).json({ error: "Invalid PRR id" });
      return;
    }

    const parsed = prrStatusTransitionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const transition = prrStore.transitionStatus({
      id: prrId,
      tenantId: auth.tenantId,
      toStatus: parsed.data.to_status,
      actorUserId: auth.userId,
      metadata: { to_status: parsed.data.to_status }
    });
    if (!transition.ok) {
      if (transition.code === "not_found") {
        res.status(404).json({ error: "Not Found" });
        return;
      }
      res.status(409).json({
        error: "Invalid status transition",
        from_status: transition.fromStatus,
        to_status: parsed.data.to_status
      });
      return;
    }

    res.status(200).json(transition.row);
  });

  app.post("/api/prr/:id/close", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!auth.tenantId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const prrId = String(req.params.id ?? "").trim();
    if (!prrId) {
      res.status(400).json({ error: "Invalid PRR id" });
      return;
    }

    const parsed = prrCloseRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const closed = prrStore.closeCase({
      id: prrId,
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      disposition: parsed.data.disposition,
      metadata: { disposition: parsed.data.disposition }
    });
    if (!closed.ok) {
      if (closed.code === "not_found") {
        res.status(404).json({ error: "Not Found" });
        return;
      }
      res.status(409).json({
        error: "Invalid status transition",
        from_status: closed.fromStatus,
        to_status: "closed"
      });
      return;
    }

    res.status(200).json(closed.row);
  });

  app.post("/api/access/request", (req, res) => {
    const parsed = accessRequestIntakeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const auth = getAuthContext(req);
    const tenantId = auth?.tenantId ?? (typeof parsed.data.tenantId === "string" ? parsed.data.tenantId.trim() : "");
    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    const actorUserId = auth?.userId ?? "public";
    const created = prrStore.intakeAccessRequest({
      tenantId,
      requesterName: parsed.data.requester_name ?? null,
      requesterEmail: parsed.data.requester_email,
      organization: parsed.data.organization ?? null,
      requestedRole: parsed.data.requested_role,
      system: parsed.data.system ?? "PuddleJumper",
      justification: parsed.data.justification,
      actorUserId,
      source: parsed.data.source ?? "api.access.request"
    });

    res.status(201).json({
      id: created.id,
      case_id: created.case_id,
      tenantId: created.tenantId,
      received_at: created.received_at,
      status: created.status,
      notification: created.notification
    });
  });

  app.post("/api/access/request/:id/status", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!auth.tenantId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const accessRequestId = String(req.params.id ?? "").trim();
    if (!accessRequestId) {
      res.status(400).json({ error: "Invalid access request id" });
      return;
    }

    const parsed = accessRequestStatusTransitionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const toStatusParsed = accessRequestStatusSchema.safeParse(parsed.data.to_status);
    if (!toStatusParsed.success) {
      res.status(400).json({ error: "Invalid status transition target" });
      return;
    }

    const transition = prrStore.transitionAccessRequestStatus({
      id: accessRequestId,
      tenantId: auth.tenantId,
      toStatus: toStatusParsed.data as AccessRequestStatus,
      actorUserId: auth.userId,
      metadata: { to_status: toStatusParsed.data }
    });
    if (!transition.ok) {
      if (transition.code === "not_found") {
        res.status(404).json({ error: "Not Found" });
        return;
      }
      res.status(409).json({
        error: "Invalid status transition",
        from_status: transition.fromStatus,
        to_status: toStatusParsed.data
      });
      return;
    }

    res.status(200).json(transition.row);
  });

  app.post("/api/access/request/:id/close", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!auth.tenantId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const accessRequestId = String(req.params.id ?? "").trim();
    if (!accessRequestId) {
      res.status(400).json({ error: "Invalid access request id" });
      return;
    }

    const parsed = accessRequestCloseRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const closed = prrStore.closeAccessRequest({
      id: accessRequestId,
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      resolution: parsed.data.resolution ?? null,
      metadata: { resolution: parsed.data.resolution ?? null }
    });
    if (!closed.ok) {
      if (closed.code === "not_found") {
        res.status(404).json({ error: "Not Found" });
        return;
      }
      res.status(409).json({
        error: "Invalid status transition",
        from_status: closed.fromStatus,
        to_status: "closed"
      });
      return;
    }

    res.status(200).json(closed.row);
  });

  app.get("/api/runtime/context", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!runtimeContext) {
      res.status(503).json({ error: "Runtime context unavailable" });
      return;
    }

    res.json({
      workspace: runtimeContext.workspace,
      municipality: runtimeContext.municipality,
      actionDefaults: runtimeContext.actionDefaults ?? {},
      operator: {
        id: auth.userId,
        name: auth.name,
        role: auth.role,
        permissions: auth.permissions,
        delegations: auth.delegations
      },
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/config/tiles", requireAuthenticated(), (_req, res) => {
    if (runtimeTiles.length === 0) {
      res.status(503).json({ error: "Runtime tiles unavailable" });
      return;
    }
    res.json(runtimeTiles);
  });

  app.get("/api/config/capabilities", requireAuthenticated(), (_req, res) => {
    if (!runtimeCapabilities) {
      res.status(503).json({ error: "Runtime capabilities unavailable" });
      return;
    }
    res.json(runtimeCapabilities);
  });

  app.get("/api/capabilities/manifest", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json(buildCapabilityManifest(auth, runtimeTiles, runtimeCapabilities));
  });

  app.get("/api/pj/actions", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const manifest = buildCapabilityManifest(auth, runtimeTiles, runtimeCapabilities);
    res.json(listAllowedPjActions(manifest));
  });

  app.get("/api/pj/identity-token", async (req, res) => {
    let auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth && msGraphTokenExchangeEnabled) {
      const graphToken = extractMsGraphToken(req);
      if (graphToken) {
        try {
          const profile = await fetchMsGraphProfile(graphToken, msGraphFetchImpl);
          const mapped = profile ? buildMsGraphAuthContext(profile, runtimeContext, nodeEnv) : null;
          if (mapped) {
            auth = mapped;
            if (nodeEnv !== "production") {
              logServerInfo("pj.identity-token.exchange.msgraph", correlationId, {
                actorUserId: auth.userId,
                tenantId: auth.tenantId
              });
            }
          }
        } catch (error) {
          logServerError("pj.identity-token.exchange.msgraph", correlationId, error);
        }
      }
    }
    if (!auth) {
      res.status(401).json({ error: "Unauthorized", correlationId });
      return;
    }

    const expiresInSeconds = 900;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const token = await signJwt(
      {
        sub: auth.userId,
        name: auth.name,
        role: auth.role,
        permissions: auth.permissions,
        tenants: auth.tenants,
        tenantId: auth.tenantId ?? undefined,
        delegations: auth.delegations
      },
      { expiresIn: `${expiresInSeconds}s` }
    );

    if (nodeEnv !== "production") {
      logServerInfo("pj.identity-token.issued", correlationId, {
        actorUserId: auth.userId,
        tenantId: auth.tenantId,
        expiresAt
      });
    }

    res.status(200).json({
      token_type: "Bearer",
      token,
      expires_in: expiresInSeconds,
      expires_at: expiresAt,
      correlationId
    });
  });

  app.post("/api/pj/execute", pjExecuteRateLimit, requireAuthenticated(), async (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }
    if (!runtimeContext) {
      res.status(503).json({ success: false, correlationId, error: "Runtime context unavailable" });
      return;
    }

    const parsed = pjExecuteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        correlationId,
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const manifest = buildCapabilityManifest(auth, runtimeTiles, runtimeCapabilities);
    const actionDefinition = PJ_ACTION_DEFINITIONS.find((entry) => entry.id === parsed.data.actionId);
    if (!actionDefinition) {
      res.status(400).json({ success: false, correlationId, error: "Unsupported actionId" });
      return;
    }
    if (!isPjActionAllowed(manifest, actionDefinition)) {
      res.status(403).json({
        success: false,
        correlationId,
        error: "Forbidden",
        details: {
          actionId: actionDefinition.id,
          requires: actionDefinition.requires
        }
      });
      return;
    }

    const evaluatePayload = buildPjEvaluatePayload(auth, runtimeContext, parsed.data, correlationId);
    if (parsed.data.mode === "dry-run") {
      delete evaluatePayload.action.requestId;
    } else if (!evaluatePayload.action.requestId) {
      const generated = scopedRequestId(auth.userId, auth.tenantId, `pj-${parsed.data.actionId}-${correlationId}`);
      if (generated) {
        evaluatePayload.action.requestId = generated;
      }
    }

    const tenantScope = assertTenantScope(auth, evaluatePayload);
    if (!tenantScope.ok) {
      res.status(403).json({
        success: false,
        correlationId,
        error: "Forbidden",
        reason: tenantScope.reason,
        details: tenantScope.details
      });
      return;
    }

    try {
      const result = await engine.evaluate(evaluatePayload);
      const statusCode = resolveDecisionStatusCode(result);
      const success = statusCode === 200 && result.approved;
      res.status(statusCode).json({
        success,
        correlationId,
        data: buildPjExecuteData(parsed.data, evaluatePayload, result),
        warnings: result.warnings
      });
    } catch (error) {
      logServerError(`${req.method} ${req.path}`, correlationId, error);
      res.status(500).json({ success: false, correlationId, error: "Internal server error" });
    }
  });

  app.get("/api/prompt", promptRateLimit, requireRole("admin"), (req, res) => {
    try {
      const content = getSystemPromptText();
      res.json({
        title: "PuddleJumper Product & System Prompt",
        version: "0.1",
        classification: "Internal / Engineering",
        systemPromptVersion: engine.systemPromptVersion,
        content
      });
    } catch (error) {
      const correlationId = getCorrelationId(res);
      logServerError(`${req.method} ${req.path}`, correlationId, error);
      res.status(500).json({ error: "Internal server error", correlationId });
    }
  });

  app.get("/api/core-prompt", promptRateLimit, requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const content = getSystemPromptText();
      const isAdmin = auth.role === "admin";
      const responseContent = isAdmin ? content : summarizePrompt(content);
      res.json({
        title: "PuddleJumper Product & System Prompt",
        version: "0.1",
        classification: isAdmin ? "Internal / Engineering" : "Internal / Summary",
        systemPromptVersion: engine.systemPromptVersion,
        mode: isAdmin ? "full" : "summary",
        editable: isAdmin,
        redacted: !isAdmin,
        content: responseContent
      });
    } catch (error) {
      const correlationId = getCorrelationId(res);
      logServerError(`${req.method} ${req.path}`, correlationId, error);
      res.status(500).json({ error: "Internal server error", correlationId });
    }
  });

  app.get("/api/identity", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json({
      name: auth.name,
      initials: initials(auth.name) || "OP",
      role: auth.role,
      tenants: auth.tenants,
      trustedParentOrigins
    });
  });

  app.post("/api/evaluate", evaluateRateLimit, requirePermission("deploy"), async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = evaluateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const payload: EvaluateRequestBody = {
      ...parsed.data,
      operator: {
        ...parsed.data.operator,
        id: auth.userId,
        name: auth.name,
        role: auth.role,
        permissions: auth.permissions,
        delegations: auth.delegations
      },
      action: {
        ...parsed.data.action,
        requestId:
          scopedRequestId(auth.userId, auth.tenantId, parsed.data.action.requestId) ??
          `${auth.userId}:${auth.tenantId ?? "no-tenant"}:auto-${crypto.randomUUID()}`
      }
    };

    const tenantScope = assertTenantScope(auth, payload);
    if (!tenantScope.ok) {
      res.status(403).json({
        error: "Forbidden",
        reason: tenantScope.reason,
        details: tenantScope.details
      });
      return;
    }

    try {
      const result = await engine.evaluate(payload);
      if (!result.approved) {
        if (result.warnings.some((warning) => /idempotency conflict|schema version mismatch/i.test(warning))) {
          res.status(409).json(result);
          return;
        }
        if (result.warnings.some((warning) => /invalid canonical source|canonical/i.test(warning))) {
          res.status(400).json(result);
          return;
        }
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      const correlationId = getCorrelationId(res);
      logServerError(`${req.method} ${req.path}`, correlationId, error);
      res.status(500).json({ error: "Internal server error", correlationId });
    }
  });

  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    const correlationId = getCorrelationId(res);
    logServerError(`${req.method} ${req.path}`, correlationId, error);
    res.status(500).json({ error: "Internal server error", correlationId });
  });

  return app;
}

export function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT ?? "8080");
  app.listen(port, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Puddle Jumper Deploy Remote listening on port ${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
