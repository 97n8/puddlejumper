import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(APP_ROOT, "data");

const DEPLOYMENT_CONTEXT_PATH = path.join(DATA_DIR, "deployment-context.json");
const DEPLOYMENT_STATE_PATH = path.join(DATA_DIR, "deployment-state.json");
const DEPLOY_LOG_PATH = path.join(DATA_DIR, "deploy-log.jsonl");
const VERITAS_ENVIRONMENTS_PATH = path.join(DATA_DIR, "environments.json");
const VERITAS_MEMORY_PATH = path.join(DATA_DIR, "veritas-memory.jsonl");

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readJsonLines(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeStage(value) {
  const stage = String(value || "").trim().toLowerCase();
  if (["sandbox", "test", "pilot", "production"].includes(stage)) {
    return stage;
  }
  if (stage === "diagnostic") {
    return "test";
  }
  if (stage === "foundations") {
    return "pilot";
  }
  if (stage === "active") {
    return "production";
  }
  return "production";
}

function toIso(value) {
  const timestamp = Date.parse(String(value || ""));
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function toLegacyRawContext(environment) {
  return {
    clientShortName: slugify(environment.town),
    clientFormalName: environment.town || "",
    environmentType: normalizeStage(environment.status),
    primaryMunicipalContact: {
      name: String(environment.tenant?.adminContact || ""),
      email: ""
    },
    microsoftTenantId: String(environment.tenant?.domain || ""),
    authorityMapping: {
      authorityGroup: "",
      operatorsGroup: "",
      readOnlyGroup: ""
    },
    optionalModules: {
      permittingWorkspace: false,
      publicRecordsWorkspace: false,
      boardComplianceWorkspace: false,
      appointmentsWorkspace: false
    }
  };
}

function buildLegacyContextEnvironment(targetId, record, veritasBySlug) {
  const context = record && typeof record === "object" ? record.context || {} : {};
  const shortName = String(context.clientShortName || "").trim();
  const formalName = String(context.clientFormalName || shortName || "Unknown").trim();
  const lookupKey = slugify(shortName || formalName);
  const matched = veritasBySlug.get(lookupKey) || null;

  return {
    targetId,
    environmentId: targetId,
    clientName: formalName,
    clientShortName: shortName || lookupKey || "unknown",
    stage: normalizeStage(context.environmentType),
    tenantId: String(context.microsoftTenantId || "").trim(),
    primaryContact: context.primaryMunicipalContact || {},
    authorityMapping: context.authorityMapping || {},
    optionalModules: context.optionalModules || {},
    updatedAt: toIso(record?.updatedAt) || new Date().toISOString(),
    consoleEnvironmentId: matched?.id || null,
    source: "deployment-context",
    _raw: context
  };
}

function buildVeritasEnvironment(environment) {
  const raw = toLegacyRawContext(environment || {});
  return {
    targetId: String(environment?.id || "").trim(),
    environmentId: String(environment?.id || "").trim(),
    clientName: String(environment?.town || "Unknown").trim(),
    clientShortName: slugify(environment?.town || "") || "unknown",
    stage: normalizeStage(environment?.status),
    tenantId: String(environment?.tenant?.domain || "").trim(),
    primaryContact: {
      name: String(environment?.tenant?.adminContact || "").trim(),
      email: ""
    },
    authorityMapping: {
      authorityGroup: "",
      operatorsGroup: "",
      readOnlyGroup: ""
    },
    optionalModules: raw.optionalModules,
    updatedAt: toIso(environment?.lastDeploy) || toIso(environment?.created) || new Date().toISOString(),
    consoleEnvironmentId: String(environment?.id || "").trim() || null,
    source: "veritas-environment",
    veritasHealth: String(environment?.health || "pending").trim().toLowerCase(),
    _raw: raw
  };
}

/**
 * Get all environments from existing data files.
 * - Primary source: deployment-context.json (read-only)
 * - Supplemented with environments.json so existing console targets are available.
 */
export function getAllEnvironments() {
  const legacyContexts = readJson(DEPLOYMENT_CONTEXT_PATH, {});
  const veritasEnvironments = readJson(VERITAS_ENVIRONMENTS_PATH, []);

  const veritasBySlug = new Map(
    Array.isArray(veritasEnvironments)
      ? veritasEnvironments.map((item) => [slugify(item?.town || ""), item])
      : []
  );

  const legacyList = Object.entries(legacyContexts || {}).map(([targetId, record]) =>
    buildLegacyContextEnvironment(targetId, record, veritasBySlug)
  );

  const existingConsoleIds = new Set(
    legacyList.map((item) => String(item.consoleEnvironmentId || "").trim()).filter(Boolean)
  );

  const veritasList = Array.isArray(veritasEnvironments)
    ? veritasEnvironments
        .filter((item) => {
          const id = String(item?.id || "").trim();
          return id && !existingConsoleIds.has(id);
        })
        .map((item) => buildVeritasEnvironment(item))
    : [];

  return [...legacyList, ...veritasList].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || 0);
    const rightTime = Date.parse(right.updatedAt || 0);
    return rightTime - leftTime;
  });
}

/**
 * Get a single environment by dashboard targetId.
 */
export function getEnvironmentById(targetId) {
  const normalized = String(targetId || "").trim();
  if (!normalized) {
    return null;
  }
  return getAllEnvironments().find((item) => item.targetId === normalized) || null;
}

/**
 * Calculate a simple environment health state.
 */
export function calculateEnvironmentHealth(environment) {
  const health = {
    overall: "healthy",
    issues: [],
    warnings: []
  };

  if (!environment) {
    return {
      overall: "warning",
      issues: ["Environment record unavailable."],
      warnings: []
    };
  }

  if (!String(environment.tenantId || "").trim()) {
    health.overall = "warning";
    health.warnings.push("No Microsoft tenant configured.");
  }

  const recentDeployments = getRecentDeployments(environment.targetId, 1);
  if (recentDeployments.length > 0) {
    const lastDeploy = recentDeployments[0];
    if (String(lastDeploy.result || "").toLowerCase() === "error") {
      health.overall = "warning";
      health.warnings.push("Last deployment failed.");
    }
  }

  if (environment.stage === "production" && recentDeployments.length > 0) {
    const lastDeployTime = Date.parse(String(recentDeployments[0].timestamp || ""));
    if (!Number.isNaN(lastDeployTime)) {
      const daysSince = Math.floor((Date.now() - lastDeployTime) / (1000 * 60 * 60 * 24));
      if (daysSince > 90) {
        health.overall = "warning";
        health.warnings.push(`No deployments in ${daysSince} days.`);
      }
    }
  }

  if (String(environment.veritasHealth || "") === "warning") {
    health.overall = "warning";
    health.warnings.push("Environment marked warning in Veritas profile.");
  }

  return health;
}

/**
 * Get deployment state from deployment-state.json.
 */
export function getDeploymentState() {
  const stateData = readJson(DEPLOYMENT_STATE_PATH, {
    phase: "idle",
    lastDeployTime: null,
    lastSuccessTime: null
  });

  if (stateData && typeof stateData === "object" && stateData.deployState) {
    return stateData.deployState;
  }

  return stateData;
}

/**
 * Get recent deployments from deploy-log.jsonl.
 */
export function getRecentDeployments(targetId = null, limit = 10) {
  const entries = readJsonLines(DEPLOY_LOG_PATH);
  const normalizedTarget = String(targetId || "").trim();

  let deployments = entries;
  if (normalizedTarget) {
    deployments = deployments.filter((entry) => {
      const environmentId = String(entry.environment_id || entry.environmentId || "").trim();
      const legacyTargetId = String(entry.targetId || "").trim();
      return environmentId === normalizedTarget || legacyTargetId === normalizedTarget;
    });
  }

  deployments.sort((left, right) => {
    const leftTime = Date.parse(String(left.timestamp || 0));
    const rightTime = Date.parse(String(right.timestamp || 0));
    return rightTime - leftTime;
  });

  return deployments.slice(0, Math.max(0, Number(limit) || 0));
}

/**
 * Extract upcoming deadlines from Veritas Memory entries.
 */
export function getUpcomingDeadlines() {
  const entries = readJsonLines(VERITAS_MEMORY_PATH);
  const deadlines = [];

  const isoPattern = /(?:due|deadline|by)\s+(\d{4}-\d{2}-\d{2})/gi;
  const namedPattern = /(?:due|deadline|by)\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi;

  for (const entry of entries) {
    const notes = String(entry.content || entry.notes || "");
    if (!notes) {
      continue;
    }

    const allMatches = [...notes.matchAll(isoPattern), ...notes.matchAll(namedPattern)];
    for (const match of allMatches) {
      const date = new Date(String(match[1] || ""));
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        continue;
      }

      deadlines.push({
        id: `${entry.id || cryptoSafeId(entry)}-${match.index || 0}`,
        date: date.toISOString(),
        title: extractDeadlineTitle(notes, match.index || 0),
        clientName: String(entry.client || entry.envId || "Unknown").trim() || "Unknown",
        environment: String(entry.environment || entry.envId || "unknown").trim() || "unknown",
        source: "memory",
        notes
      });
    }
  }

  deadlines.sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  return deadlines.slice(0, 5);
}

function cryptoSafeId(entry) {
  const payload = JSON.stringify(entry || {});
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 31 + payload.charCodeAt(index)) >>> 0;
  }
  return `m-${hash.toString(16)}`;
}

function extractDeadlineTitle(notes, matchIndex) {
  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(notes.length, matchIndex + 50);
  let title = notes.slice(start, end).trim();

  if (start > 0) {
    title = `...${title}`;
  }
  if (end < notes.length) {
    title = `${title}...`;
  }

  return title || "Deadline";
}
