import crypto from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import express from "express";

import { appendAuditEntry, readAuditEntries } from "../src/audit.js";
import {
  getAllEnvironments as getDashboardEnvironments,
  getEnvironmentById as getDashboardEnvironmentById,
  calculateEnvironmentHealth as calculateDashboardEnvironmentHealth,
  getDeploymentState as getDashboardDeploymentState,
  getRecentDeployments as getDashboardRecentDeployments,
  getUpcomingDeadlines as getDashboardUpcomingDeadlines
} from "../services/environment-helper.js";

const ENV_STATUSES = new Set(["active", "foundations", "diagnostic", "prospect"]);
const HEALTH_STATUSES = new Set(["nominal", "pending", "warning"]);
const MEMORY_TYPES = new Set(["deployment", "note", "quirk", "decision"]);
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIMPLE_HOST_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

const DEFAULT_CONTEXT = {
  targetTenant: {
    type: "M365",
    domain: "",
    adminContact: "",
    notes: ""
  },
  selectedModules: [],
  overrides: [],
  checklist: {
    adminAccessVerified: false,
    charterReviewed: false,
    contactsConfirmed: false
  },
  graph: {
    sharePointSiteUrl: "",
    graphBaseUrl: "https://graph.microsoft.com/v1.0",
    authRef: ""
  },
  metadata: {
    updatedBy: "",
    updatedAt: ""
  }
};

const DEPLOYMENT_CONTEXT_SCHEMA = {
  title: "Tenebrux Veritas Deployment Context",
  required: [
    "targetTenant.domain",
    "targetTenant.adminContact",
    "graph.sharePointSiteUrl",
    "checklist.adminAccessVerified",
    "checklist.charterReviewed",
    "checklist.contactsConfirmed"
  ],
  fields: {
    "targetTenant.domain": {
      type: "string",
      example: "sampletownma.sharepoint.com",
      description: "Municipal tenant host used for deployment scope."
    },
    "targetTenant.adminContact": {
      type: "string",
      example: "dave@regionalitcoop.com",
      description: "Primary admin owner for access and escalation."
    },
    "graph.sharePointSiteUrl": {
      type: "string",
      example: "https://sampletownma.sharepoint.com/sites/Clerk",
      description: "Base SharePoint site URL for structure provisioning."
    },
    "graph.authRef": {
      type: "string",
      example: "keychain://publiclogic/sampletown",
      description: "Credential reference for Graph execution (optional for simulation)."
    },
    "selectedModules": {
      type: "array",
      example: ["Foundations", "Public Records"],
      description: "Requested modules for the deployment cycle."
    }
  }
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isIsoDate(value) {
  return !Number.isNaN(Date.parse(String(value || "")));
}

function uniqueStrings(values) {
  return [...new Set(toArray(values).map((item) => String(item || "").trim()).filter(Boolean))];
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonLines(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
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
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function appendJsonLine(filePath, entry) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

function normalizeEnvironment(input, operator = "") {
  const source = toObject(input);
  const town = String(source.town || "").trim();
  const id = String(source.id || `env-${crypto.randomUUID().slice(0, 8)}`).trim();
  const status = String(source.status || "prospect").trim().toLowerCase();
  const health = String(source.health || "pending").trim().toLowerCase();
  const now = new Date().toISOString();

  return {
    id,
    town,
    status: ENV_STATUSES.has(status) ? status : "prospect",
    tenant: {
      type: String(source.tenant?.type || "M365").trim(),
      domain: String(source.tenant?.domain || "").trim(),
      adminContact: String(source.tenant?.adminContact || "").trim(),
      notes: String(source.tenant?.notes || "").trim()
    },
    modules: uniqueStrings(source.modules),
    contacts: toArray(source.contacts).map((contact) => ({
      name: String(contact?.name || "").trim(),
      role: String(contact?.role || "").trim(),
      notes: String(contact?.notes || "").trim()
    })),
    liveUrl: String(source.liveUrl || source.links?.live || "").trim(),
    operator: String(source.operator || operator).trim(),
    health: HEALTH_STATUSES.has(health) ? health : "pending",
    created: isIsoDate(source.created) ? new Date(source.created).toISOString() : now,
    lastDeploy: isIsoDate(source.lastDeploy) ? new Date(source.lastDeploy).toISOString() : null,
    archived: Boolean(source.archived)
  };
}

function validateEnvironmentPayload(environment) {
  const errors = [];

  if (!String(environment.town || "").trim()) {
    errors.push("Town name is required.");
  }
  if (!ENV_STATUSES.has(environment.status)) {
    errors.push("Status must be active, foundations, diagnostic, or prospect.");
  }
  if (!HEALTH_STATUSES.has(environment.health)) {
    errors.push("Health must be nominal, pending, or warning.");
  }
  if (!String(environment.tenant.domain || "").trim()) {
    errors.push("Tenant domain is required.");
  }
  if (!String(environment.operator || "").trim()) {
    errors.push("Operator is required.");
  }
  if (environment.liveUrl && !isProbablyUrl(environment.liveUrl)) {
    errors.push("Live URL must be a valid absolute URL.");
  }

  return errors;
}

function normalizeContextPayload(raw, operator = "") {
  const source = toObject(raw);
  const base = structuredClone(DEFAULT_CONTEXT);
  const merged = {
    ...base,
    ...source,
    targetTenant: {
      ...base.targetTenant,
      ...toObject(source.targetTenant)
    },
    checklist: {
      ...base.checklist,
      ...toObject(source.checklist)
    },
    graph: {
      ...base.graph,
      ...toObject(source.graph)
    },
    metadata: {
      ...base.metadata,
      ...toObject(source.metadata)
    }
  };

  merged.selectedModules = uniqueStrings(merged.selectedModules);
  merged.overrides = toArray(merged.overrides).map((item) => String(item || "").trim()).filter(Boolean);
  merged.targetTenant.type = String(merged.targetTenant.type || "M365").trim();
  merged.targetTenant.domain = String(merged.targetTenant.domain || "").trim();
  merged.targetTenant.adminContact = String(merged.targetTenant.adminContact || "").trim();
  merged.targetTenant.notes = String(merged.targetTenant.notes || "").trim();
  merged.graph.sharePointSiteUrl = String(merged.graph.sharePointSiteUrl || "").trim();
  merged.graph.graphBaseUrl = String(merged.graph.graphBaseUrl || "https://graph.microsoft.com/v1.0").trim();
  merged.graph.authRef = String(merged.graph.authRef || "").trim();
  merged.metadata.updatedBy = String(operator || merged.metadata.updatedBy || "").trim();
  merged.metadata.updatedAt = new Date().toISOString();
  merged.checklist = {
    adminAccessVerified: Boolean(merged.checklist.adminAccessVerified),
    charterReviewed: Boolean(merged.checklist.charterReviewed),
    contactsConfirmed: Boolean(merged.checklist.contactsConfirmed)
  };

  return merged;
}

function normalizeHost(value) {
  return String(value || "").trim().toLowerCase();
}

function isProbablyUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function createContextIssue(field, message, why, fix, example = "") {
  return {
    field,
    message,
    why,
    fix,
    example
  };
}

function validateContextPayloadDetailed(context) {
  const issues = [];
  const targetTenantDomain = normalizeHost(context.targetTenant?.domain);
  const adminContact = String(context.targetTenant?.adminContact || "").trim();
  const sharePointSiteUrl = String(context.graph?.sharePointSiteUrl || "").trim();

  if (!targetTenantDomain) {
    issues.push(
      createContextIssue(
        "targetTenant.domain",
        "Target tenant domain is required.",
        "Deployment scope cannot be resolved without the municipality tenant host.",
        "Enter the tenant host in target tenant domain.",
        DEPLOYMENT_CONTEXT_SCHEMA.fields["targetTenant.domain"].example
      )
    );
  } else if (!SIMPLE_HOST_PATTERN.test(targetTenantDomain)) {
    issues.push(
      createContextIssue(
        "targetTenant.domain",
        "Target tenant domain format is invalid.",
        "Invalid hosts can route deployment operations to the wrong target.",
        "Use a host only value (no protocol or path).",
        DEPLOYMENT_CONTEXT_SCHEMA.fields["targetTenant.domain"].example
      )
    );
  }

  if (!adminContact) {
    issues.push(
      createContextIssue(
        "targetTenant.adminContact",
        "Target tenant admin contact is required.",
        "Operator escalation chain must be explicit before deployment.",
        "Add responsible admin contact name or email.",
        DEPLOYMENT_CONTEXT_SCHEMA.fields["targetTenant.adminContact"].example
      )
    );
  } else if (adminContact.includes("@") && !SIMPLE_EMAIL_PATTERN.test(adminContact)) {
    issues.push(
      createContextIssue(
        "targetTenant.adminContact",
        "Admin contact email format is invalid.",
        "Broken contact details block governance and access escalation.",
        "Use a valid email address or plain contact name.",
        DEPLOYMENT_CONTEXT_SCHEMA.fields["targetTenant.adminContact"].example
      )
    );
  }

  if (!sharePointSiteUrl) {
    issues.push(
      createContextIssue(
        "graph.sharePointSiteUrl",
        "SharePoint site URL is required.",
        "Governance diff cannot compute provisioning targets without a site root.",
        "Enter the full SharePoint site URL.",
        DEPLOYMENT_CONTEXT_SCHEMA.fields["graph.sharePointSiteUrl"].example
      )
    );
  } else if (!isProbablyUrl(sharePointSiteUrl)) {
    issues.push(
      createContextIssue(
        "graph.sharePointSiteUrl",
        "SharePoint site URL format is invalid.",
        "Invalid URLs break structure provisioning and preflight checks.",
        "Use an absolute URL with http/https.",
        DEPLOYMENT_CONTEXT_SCHEMA.fields["graph.sharePointSiteUrl"].example
      )
    );
  }

  if (!context.checklist?.adminAccessVerified) {
    issues.push(
      createContextIssue(
        "checklist.adminAccessVerified",
        "Checklist item missing: admin access verified.",
        "Unverified admin access can cause partial or failed deployment.",
        "Confirm access with the municipal owner and check this item.",
        "true"
      )
    );
  }

  if (!context.checklist?.charterReviewed) {
    issues.push(
      createContextIssue(
        "checklist.charterReviewed",
        "Checklist item missing: charter reviewed.",
        "Charter constraints govern ownership and escalation structures.",
        "Review charter/bylaws and confirm this item.",
        "true"
      )
    );
  }

  if (!context.checklist?.contactsConfirmed) {
    issues.push(
      createContextIssue(
        "checklist.contactsConfirmed",
        "Checklist item missing: contacts confirmed.",
        "Unconfirmed contacts undermine continuity and handoff reliability.",
        "Validate contacts before deployment and check this item.",
        "true"
      )
    );
  }

  return issues;
}

function validateContextPayload(context) {
  return validateContextPayloadDetailed(context).map((issue) => issue.message);
}

function createContextFilePath(contextsDir, environmentId) {
  return path.join(contextsDir, `${environmentId}-context.json`);
}

function createConnectionFilePath(connectionsDir, environmentId) {
  return path.join(connectionsDir, `${environmentId}-connection.json`);
}

function listModuleCatalog(canon) {
  const foundations = toArray(canon.foundations);
  const workspaces = toArray(canon.workspaces);
  const modulesByName = new Map();
  for (const module of [...foundations, ...workspaces]) {
    modulesByName.set(String(module.name || "").trim(), module);
  }
  return {
    foundations,
    workspaces,
    modulesByName
  };
}

function computeDependencyStatus({ canon, selectedModules, existingModules }) {
  const selected = new Set(uniqueStrings(selectedModules));
  const existing = new Set(uniqueStrings(existingModules));
  const combined = new Set([...selected, ...existing]);
  const catalog = listModuleCatalog(canon);
  const foundationNames = catalog.foundations.map((module) => module.name);
  const workspaceNames = catalog.workspaces.map((module) => module.name);
  const selectedWorkspaces = workspaceNames.filter((name) => selected.has(name));

  const unknownModules = [...selected].filter((name) => !catalog.modulesByName.has(name));
  const missingFoundations = foundationNames.filter((name) => !combined.has(name));

  const missingDependencies = [];
  for (const workspaceName of selectedWorkspaces) {
    const workspace = catalog.modulesByName.get(workspaceName);
    const dependencies = uniqueStrings(workspace?.dependsOn);
    const unmet = dependencies.filter((dependency) => !combined.has(dependency));
    if (unmet.length > 0) {
      missingDependencies.push({
        workspace: workspaceName,
        missing: unmet
      });
    }
  }

  const allFoundationsPresent = missingFoundations.length === 0;
  const dependenciesMet = missingDependencies.length === 0;
  const canonCompliant = unknownModules.length === 0;

  return {
    selected,
    combined,
    selectedWorkspaces,
    allFoundationsPresent,
    dependenciesMet,
    canonCompliant,
    missingFoundations,
    missingDependencies,
    unknownModules,
    foundationNames
  };
}

function buildGovernanceDiff({
  environment,
  context,
  canon,
  selectedModules
}) {
  const dependencyStatus = computeDependencyStatus({
    canon,
    selectedModules,
    existingModules: environment.modules
  });

  const warnings = [];
  const blockers = [];

  if (!context.targetTenant.adminContact) {
    warnings.push("Tenant admin contact is blank. Confirm authority chain before deployment.");
  }
  if (!context.graph.authRef) {
    warnings.push("No Graph auth reference configured. Deployment will run in simulation mode.");
  }

  if (!dependencyStatus.canonCompliant) {
    blockers.push(
      `Unknown modules selected: ${dependencyStatus.unknownModules.join(", ")}. Only canon modules are deployable.`
    );
  }

  if (dependencyStatus.selectedWorkspaces.length > 0 && !dependencyStatus.allFoundationsPresent) {
    blockers.push(
      `Workspace deployment blocked until all Foundations are present. Missing: ${dependencyStatus.missingFoundations.join(", ")}.`
    );
  }

  if (!dependencyStatus.dependenciesMet) {
    for (const missing of dependencyStatus.missingDependencies) {
      blockers.push(
        `${missing.workspace} missing dependencies: ${missing.missing.join(", ")}.`
      );
    }
  }

  const structures = [
    {
      type: "SharePoint Site",
      name: `VAULT-Foundations-${environment.town}`,
      action: "create",
      details: `${context.targetTenant.domain}/sites/vault-${slugify(environment.town)}`
    }
  ];

  const libraries = dependencyStatus.foundationNames.map((foundationName) => ({
    site: `VAULT-Foundations-${environment.town}`,
    name: foundationName,
    action: "create"
  }));

  const flows = [
    {
      name: "Decision Routing",
      trigger: "List Item Created/Updated",
      action: "create"
    },
    {
      name: "Retention Enforcement",
      trigger: "Daily Compliance Sweep",
      action: "create"
    },
    {
      name: "Audit Logging",
      trigger: "Any Governance Change",
      action: "create"
    }
  ];

  const permissions = [
    {
      group: "VAULT-Operators",
      level: "Full Control",
      scope: `VAULT-Foundations-${environment.town}`
    },
    {
      group: "Municipal-ReadOnly",
      level: "Read",
      scope: `VAULT-Foundations-${environment.town}`
    }
  ];

  return {
    diffId: `diff-${crypto.randomUUID()}`,
    generatedAt: new Date().toISOString(),
    environmentId: environment.id,
    town: environment.town,
    selectedModules: [...dependencyStatus.selected],
    structures,
    libraries,
    flows,
    permissions,
    warnings,
    blockers,
    validations: {
      allFoundationsPresent: dependencyStatus.allFoundationsPresent,
      dependenciesMet: dependencyStatus.dependenciesMet,
      canonCompliant: dependencyStatus.canonCompliant
    }
  };
}

function parseAcknowledgments(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function actionTypeFromModules(canon, selectedModules) {
  const catalog = listModuleCatalog(canon);
  const selected = new Set(uniqueStrings(selectedModules));
  const hasWorkspace = catalog.workspaces.some((module) => selected.has(module.name));
  if (!hasWorkspace) {
    return "deploy:foundations";
  }
  return "deploy:workspace";
}

function createDeployPhrase(town) {
  return `deploy ${String(town || "").trim().toLowerCase()}`;
}

async function loadEnvironmentById(environmentsPath, environmentId) {
  const environments = toArray(await readJson(environmentsPath, []));
  const environment = environments.find((entry) => entry.id === environmentId && !entry.archived);
  return {
    environments,
    environment
  };
}

async function loadEnvironmentRemoteScope(config, environmentId, operator) {
  const { environment } = await loadEnvironmentById(config.veritasEnvironmentsPath, environmentId);
  if (!environment) {
    throw createHttpError(404, "Environment not found.");
  }

  const contextFilePath = createContextFilePath(config.veritasDeploymentContextsDir, environmentId);
  const connectionFilePath = createConnectionFilePath(config.veritasConnectionsDir, environmentId);
  const context = normalizeContextPayload(await readJson(contextFilePath, { ...DEFAULT_CONTEXT }), operator);
  const connection = await readJson(connectionFilePath, null);

  return {
    environment,
    context,
    connection
  };
}

async function resolveSharePointSession({ config, environmentId, operator, libraryName }) {
  const { environment, context, connection } = await loadEnvironmentRemoteScope(
    config,
    environmentId,
    operator
  );

  if (!connection) {
    throw createHttpError(400, "Connection record is missing. Save connection refs first.");
  }
  if (!connection.graphEnabled) {
    throw createHttpError(400, "Graph execution is disabled for this environment.");
  }

  const tenantDomain = String(
    context.targetTenant?.domain || environment.tenant?.domain || connection.tenantDomain || ""
  ).trim();
  const siteUrl = normalizeSharePointSiteUrl(context.graph?.sharePointSiteUrl, tenantDomain);
  if (!siteUrl) {
    throw createHttpError(400, "SharePoint site URL is missing in deployment context.");
  }

  const tenantId = await resolveSecretReference(connection.tenantIdRef, "tenantIdRef", config);
  const clientId = await resolveSecretReference(connection.clientIdRef, "clientIdRef", config);
  const clientSecret = await resolveSecretReference(connection.keychainRef, "keychainRef", config);
  const graphBaseUrl = normalizeGraphBaseUrl(context.graph?.graphBaseUrl);
  const accessToken = await requestGraphToken({ tenantId, clientId, clientSecret });
  const site = await resolveSiteByUrl({ accessToken, graphBaseUrl, siteUrl });
  const drive = await resolveDrive({
    accessToken,
    graphBaseUrl,
    siteId: site.id,
    libraryName
  });

  return {
    environment,
    context,
    connection,
    accessToken,
    graphBaseUrl,
    siteUrl,
    site,
    drive
  };
}

function filterEntries(entries, { envId = "", type = "", q = "" }) {
  const envFilter = String(envId || "").trim();
  const typeFilter = String(type || "").trim().toLowerCase();
  const query = String(q || "").trim().toLowerCase();
  return entries.filter((entry) => {
    if (envFilter && String(entry.envId || "") !== envFilter) {
      return false;
    }
    if (typeFilter && String(entry.type || "").toLowerCase() !== typeFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = JSON.stringify(entry).toLowerCase();
    return haystack.includes(query);
  });
}

function sanitizeConnectionPayload(raw) {
  const source = toObject(raw);
  const forbiddenKeys = ["password", "secret", "token", "clientSecret", "accessToken"];
  for (const key of Object.keys(source)) {
    if (forbiddenKeys.includes(key)) {
      throw new Error(`Connection payload cannot include plaintext '${key}'. Use a secure reference.`);
    }
  }
  return {
    tenantDomain: String(source.tenantDomain || "").trim(),
    authType: String(source.authType || "entra").trim(),
    clientIdRef: String(source.clientIdRef || "").trim(),
    tenantIdRef: String(source.tenantIdRef || "").trim(),
    keychainRef: String(source.keychainRef || "").trim(),
    graphEnabled: Boolean(source.graphEnabled),
    updatedAt: new Date().toISOString(),
    notes: String(source.notes || "").trim()
  };
}

function sanitizeSegment(value, fallback = "item") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function sanitizeDocumentName(value, fallback = "note") {
  const raw = String(value || "").trim();
  if (!raw) {
    return `${fallback}.md`;
  }
  const cleaned = raw
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) {
    return `${fallback}.md`;
  }
  if (cleaned.includes(".")) {
    return cleaned;
  }
  return `${cleaned}.md`;
}

function isPathInside(parentPath, candidatePath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  const prefix = parent.endsWith(path.sep) ? parent : `${parent}${path.sep}`;
  return candidate === parent || candidate.startsWith(prefix);
}

function buildProofRootPath(config, envId) {
  return path.join(config.dataDir, "proof-system", envId);
}

function buildProofLogPath(config) {
  return path.join(config.dataDir, "proof-log.jsonl");
}

function buildProofEntryBase({ envId, town, operator, type }) {
  return {
    id: `proof-${crypto.randomUUID().slice(0, 12)}`,
    envId,
    town,
    type,
    operator,
    createdAt: new Date().toISOString()
  };
}

function createHttpError(status, message) {
  const error = new Error(String(message || "Request failed."));
  error.status = status;
  return error;
}

function formatGraphErrorBody(rawBody) {
  const text = String(rawBody || "").trim();
  if (!text) {
    return "";
  }
  if (text.length <= 320) {
    return text;
  }
  return `${text.slice(0, 320)}...`;
}

function normalizeGraphBaseUrl(value) {
  const fallback = "https://graph.microsoft.com/v1.0";
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }
  return raw.replace(/\/+$/, "");
}

function normalizeSharePointSiteUrl(value, fallbackDomain = "") {
  const raw = String(value || "").trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  const tenant = String(fallbackDomain || "").trim();
  if (!tenant) {
    return "";
  }
  return `https://${tenant}/sites/PL`;
}

function parseSharePointSiteUrl(siteUrl) {
  let parsed;
  try {
    parsed = new URL(String(siteUrl || "").trim());
  } catch {
    throw createHttpError(400, "SharePoint site URL is invalid.");
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw createHttpError(400, "SharePoint site URL must use http/https.");
  }
  const serverRelativePath = parsed.pathname.replace(/\/+$/, "");
  if (!serverRelativePath || serverRelativePath === "/") {
    throw createHttpError(400, "SharePoint site URL must include a site path (for example /sites/PL).");
  }
  return {
    hostname: parsed.hostname,
    serverRelativePath
  };
}

function encodeGraphPath(pathValue) {
  return String(pathValue || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parsePathSegments(pathValue) {
  const raw = String(pathValue || "").trim();
  if (!raw) {
    return [];
  }
  const segments = raw
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw createHttpError(400, "Path segments cannot contain '.' or '..'.");
  }
  return segments;
}

async function execFileCommand(filePath, args, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 300_000);
  return await new Promise((resolve) => {
    execFileCallback(
      filePath,
      args,
      {
        cwd: options.cwd,
        timeout: timeoutMs,
        env: options.env
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            stdout: String(stdout || ""),
            stderr: String(stderr || error.message || ""),
            code: typeof error.code === "number" ? error.code : 1
          });
          return;
        }
        resolve({
          ok: true,
          stdout: String(stdout || ""),
          stderr: String(stderr || ""),
          code: 0
        });
      }
    );
  });
}

async function resolveSecretReference(refValue, label, config) {
  const raw = String(refValue || "").trim();
  if (!raw) {
    throw createHttpError(400, `${label} is required for SharePoint remote operations.`);
  }

  if (raw.startsWith("env://")) {
    const envKey = raw.slice("env://".length).trim();
    const envValue = String(process.env[envKey] || "").trim();
    if (!envValue) {
      throw createHttpError(400, `${label} points to missing environment variable '${envKey}'.`);
    }
    return envValue;
  }

  if (raw.startsWith("keychain://")) {
    const identifier = raw.slice("keychain://".length).trim();
    if (!identifier) {
      throw createHttpError(400, `${label} keychain reference is invalid.`);
    }
    const [service, account] = identifier.split("/").map((part) => String(part || "").trim());
    if (!service) {
      throw createHttpError(400, `${label} keychain reference must include a service name.`);
    }
    const args = ["find-generic-password", "-s", service, "-w"];
    if (account) {
      args.splice(3, 0, "-a", account);
    }
    const result = await execFileCommand("security", args, {
      cwd: config.appRoot,
      timeoutMs: 10_000,
      env: process.env
    });
    if (!result.ok) {
      throw createHttpError(
        400,
        `${label} could not be resolved from macOS Keychain (${service}${account ? `/${account}` : ""}).`
      );
    }
    const secret = String(result.stdout || "").trim();
    if (!secret) {
      throw createHttpError(400, `${label} keychain secret is empty.`);
    }
    return secret;
  }

  return raw;
}

async function requestGraphToken({ tenantId, clientId, clientSecret }) {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(
    tenantId
  )}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const hint = payload?.error_description || payload?.error || "Token request failed.";
    throw createHttpError(401, `Graph auth failed. ${hint}`);
  }
  return payload.access_token;
}

async function graphRequest({
  accessToken,
  graphBaseUrl,
  requestPath,
  method = "GET",
  body,
  headers = {}
}) {
  const base = normalizeGraphBaseUrl(graphBaseUrl);
  const url = `${base}${requestPath.startsWith("/") ? requestPath : `/${requestPath}`}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers
    },
    body
  });
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  if (!response.ok) {
    const reason = formatGraphErrorBody(text) || `${response.status} ${response.statusText}`;
    const error = createHttpError(
      response.status >= 400 && response.status < 600 ? response.status : 502,
      `Graph request failed for ${requestPath}. ${reason}`
    );
    error.graphStatus = response.status;
    throw error;
  }
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function resolveSiteByUrl({ accessToken, graphBaseUrl, siteUrl }) {
  const { hostname, serverRelativePath } = parseSharePointSiteUrl(siteUrl);
  const encodedPath = serverRelativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return await graphRequest({
    accessToken,
    graphBaseUrl,
    requestPath: `/sites/${hostname}:${encodedPath}?$select=id,name,webUrl`
  });
}

async function resolveDrive({ accessToken, graphBaseUrl, siteId, libraryName }) {
  const requested = String(libraryName || "").trim().toLowerCase();
  const drivesResponse = await graphRequest({
    accessToken,
    graphBaseUrl,
    requestPath: `/sites/${siteId}/drives?$select=id,name,webUrl,driveType`
  });
  const drives = Array.isArray(drivesResponse?.value) ? drivesResponse.value : [];
  if (!drives.length) {
    throw createHttpError(404, "No SharePoint drives were found for this site.");
  }

  if (!requested) {
    const fallback = drives[0];
    return {
      id: fallback.id,
      name: fallback.name,
      webUrl: fallback.webUrl
    };
  }

  const aliases = new Set([requested]);
  if (requested === "documents") {
    aliases.add("shared documents");
  }
  if (requested === "shared documents") {
    aliases.add("documents");
  }

  const match = drives.find((drive) => aliases.has(String(drive.name || "").trim().toLowerCase()));
  if (!match) {
    const available = drives.map((drive) => drive.name).filter(Boolean).join(", ");
    throw createHttpError(
      404,
      `SharePoint library '${libraryName}' was not found. Available libraries: ${available || "none"}.`
    );
  }

  return {
    id: match.id,
    name: match.name,
    webUrl: match.webUrl
  };
}

async function ensureDriveFolderPath({
  accessToken,
  graphBaseUrl,
  driveId,
  folderSegments
}) {
  if (!Array.isArray(folderSegments) || folderSegments.length === 0) {
    return {
      relativePath: "",
      folderItem: null
    };
  }

  let currentSegments = [];
  let lastItem = null;

  for (const segment of folderSegments) {
    currentSegments = [...currentSegments, segment];
    const currentPath = currentSegments.join("/");
    const encodedCurrentPath = encodeGraphPath(currentPath);
    const parentPath = currentSegments.slice(0, -1).join("/");
    const encodedParentPath = encodeGraphPath(parentPath);

    const requestPath = encodedParentPath
      ? `/drives/${driveId}/root:/${encodedParentPath}:/children`
      : `/drives/${driveId}/root/children`;

    try {
      lastItem = await graphRequest({
        accessToken,
        graphBaseUrl,
        requestPath,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: segment,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail"
        })
      });
    } catch (error) {
      if (error?.graphStatus !== 409) {
        throw error;
      }
      lastItem = await graphRequest({
        accessToken,
        graphBaseUrl,
        requestPath: `/drives/${driveId}/root:/${encodedCurrentPath}?$select=id,name,webUrl,parentReference`
      });
    }
  }

  return {
    relativePath: folderSegments.join("/"),
    folderItem: lastItem
  };
}

function ensureAspxName(pageName, pageTitle) {
  const fallbackBase =
    sanitizeSegment(pageTitle, "remote-page")
      .replace(/\.+$/g, "")
      .slice(0, 80) || "remote-page";
  const raw = String(pageName || "").trim();
  if (!raw) {
    return `${fallbackBase}.aspx`;
  }
  const sanitized = raw
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const finalName = sanitized || fallbackBase;
  return finalName.toLowerCase().endsWith(".aspx") ? finalName : `${finalName}.aspx`;
}

function createBasicPageHtml({ title, body }) {
  const safeTitle = String(title || "Untitled Page").trim() || "Untitled Page";
  const safeBody = String(body || "").trim();
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>${safeTitle}</title>`,
    "</head>",
    "<body>",
    `  <h1>${safeTitle}</h1>`,
    safeBody ? `  <p>${safeBody}</p>` : "  <p>Generated by Tenebrux Veritas remote control.</p>",
    "</body>",
    "</html>"
  ].join("\n");
}

function excerpt(value, max = 400) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}...`;
}

export function createVeritasRouter({
  config,
  requireOperatorAuth,
  runtime,
  getGitHeadSha
}) {
  const router = express.Router();
  runtime.veritasDiffCache = runtime.veritasDiffCache || new Map();

  router.get("/veritas/canon", requireOperatorAuth, async (_req, res) => {
    const canon = await readJson(config.veritasCanonPath, { foundations: [], workspaces: [] });
    res.json(canon);
  });

  router.get("/veritas/environments", requireOperatorAuth, async (req, res) => {
    const statusFilter = String(req.query.status || "").trim().toLowerCase();
    const query = String(req.query.q || "").trim().toLowerCase();
    const includeArchived = String(req.query.includeArchived || "").trim() === "1";
    const environments = toArray(await readJson(config.veritasEnvironmentsPath, []))
      .map((entry) => normalizeEnvironment(entry))
      .filter((entry) => includeArchived || !entry.archived)
      .filter((entry) => (statusFilter ? entry.status === statusFilter : true))
      .filter((entry) => {
        if (!query) {
          return true;
        }
        return JSON.stringify(entry).toLowerCase().includes(query);
      })
      .sort((a, b) => String(a.town).localeCompare(String(b.town)));
    res.json({ environments });
  });

  router.get("/veritas/environments/:id", requireOperatorAuth, async (req, res) => {
    const environmentId = String(req.params.id || "").trim();
    const { environment } = await loadEnvironmentById(config.veritasEnvironmentsPath, environmentId);
    if (!environment) {
      res.status(404).json({ error: "Environment not found." });
      return;
    }
    res.json(environment);
  });

  router.post("/veritas/environments", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const environments = toArray(await readJson(config.veritasEnvironmentsPath, []));
    const nextEnvironment = normalizeEnvironment(req.body, operator);
    const validationErrors = validateEnvironmentPayload(nextEnvironment);

    if (validationErrors.length > 0) {
      res.status(400).json({ error: "Invalid environment payload.", errors: validationErrors });
      return;
    }

    if (environments.some((entry) => entry.id === nextEnvironment.id && !entry.archived)) {
      res.status(409).json({ error: "Environment ID already exists." });
      return;
    }

    environments.push(nextEnvironment);
    await writeJson(config.veritasEnvironmentsPath, environments);
    res.status(201).json(nextEnvironment);
  });

  router.put("/veritas/environments/:id", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const environmentId = String(req.params.id || "").trim();
    const environments = toArray(await readJson(config.veritasEnvironmentsPath, []));
    const index = environments.findIndex((entry) => entry.id === environmentId && !entry.archived);
    if (index === -1) {
      res.status(404).json({ error: "Environment not found." });
      return;
    }

    const merged = normalizeEnvironment(
      { ...environments[index], ...req.body, id: environmentId, operator },
      operator
    );
    const validationErrors = validateEnvironmentPayload(merged);
    if (validationErrors.length > 0) {
      res.status(400).json({ error: "Invalid environment payload.", errors: validationErrors });
      return;
    }

    environments[index] = merged;
    await writeJson(config.veritasEnvironmentsPath, environments);
    res.json(merged);
  });

  router.delete("/veritas/environments/:id", requireOperatorAuth, async (req, res) => {
    const environmentId = String(req.params.id || "").trim();
    const environments = toArray(await readJson(config.veritasEnvironmentsPath, []));
    const index = environments.findIndex((entry) => entry.id === environmentId && !entry.archived);
    if (index === -1) {
      res.status(404).json({ error: "Environment not found." });
      return;
    }
    environments[index] = {
      ...normalizeEnvironment(environments[index]),
      archived: true
    };
    await writeJson(config.veritasEnvironmentsPath, environments);
    res.status(204).send();
  });

  router.get("/veritas/environments/:id/context", requireOperatorAuth, async (req, res) => {
    const environmentId = String(req.params.id || "").trim();
    const filePath = createContextFilePath(config.veritasDeploymentContextsDir, environmentId);
    const context = normalizeContextPayload(
      await readJson(filePath, { ...DEFAULT_CONTEXT }),
      req.session.user.username
    );
    res.json(context);
  });

  router.get("/veritas/schema/deployment-context", requireOperatorAuth, (_req, res) => {
    res.json({
      schema: DEPLOYMENT_CONTEXT_SCHEMA
    });
  });

  router.put("/veritas/environments/:id/context", requireOperatorAuth, async (req, res) => {
    const environmentId = String(req.params.id || "").trim();
    const filePath = createContextFilePath(config.veritasDeploymentContextsDir, environmentId);
    const context = normalizeContextPayload(req.body, req.session.user.username);
    const validationIssues = validateContextPayloadDetailed(context);
    if (validationIssues.length > 0) {
      res.status(400).json({
        error: "Deployment context is incomplete.",
        errors: validationIssues.map((issue) => issue.message),
        fieldErrors: validationIssues,
        schema: DEPLOYMENT_CONTEXT_SCHEMA
      });
      return;
    }
    await writeJson(filePath, context);
    res.json(context);
  });

  router.get("/veritas/environments/:id/connection", requireOperatorAuth, async (req, res) => {
    const environmentId = String(req.params.id || "").trim();
    const filePath = createConnectionFilePath(config.veritasConnectionsDir, environmentId);
    const connection = await readJson(filePath, null);
    res.json({
      environmentId,
      connection
    });
  });

  router.put("/veritas/environments/:id/connection", requireOperatorAuth, async (req, res) => {
    const environmentId = String(req.params.id || "").trim();
    const filePath = createConnectionFilePath(config.veritasConnectionsDir, environmentId);
    let connection;
    try {
      connection = sanitizeConnectionPayload(req.body);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    await writeJson(filePath, connection);
    res.json({
      environmentId,
      connection
    });
  });

  router.get("/veritas/remote/:envId/status", requireOperatorAuth, async (req, res) => {
    const envId = String(req.params.envId || "").trim();
    if (!envId) {
      res.status(400).json({ error: "envId is required." });
      return;
    }

    try {
      const { environment, context, connection } = await loadEnvironmentRemoteScope(
        config,
        envId,
        req.session.user.username
      );
      const tenantDomain = String(
        context.targetTenant?.domain || environment.tenant?.domain || connection?.tenantDomain || ""
      ).trim();
      const siteUrl = normalizeSharePointSiteUrl(context.graph?.sharePointSiteUrl, tenantDomain);
      const remoteTarget = runtime.activeTarget
        ? {
            repoName: runtime.activeTarget.repoName,
            repoRoot: runtime.activeTarget.repoRoot,
            branch: runtime.activeTarget.branch,
            relativeFilePath: path
              .relative(runtime.activeTarget.repoRoot, runtime.activeTarget.targetFilePath)
              .split(path.sep)
              .join("/"),
            targetFilePath: runtime.activeTarget.targetFilePath,
            previewUrl: runtime.activeTarget.previewUrl,
            originRemote: runtime.activeTarget.originRemote
          }
        : null;

      const missing = [];
      if (!connection) {
        missing.push("connection");
      }
      if (connection && !connection.graphEnabled) {
        missing.push("connection.graphEnabled");
      }
      if (!String(connection?.clientIdRef || "").trim()) {
        missing.push("connection.clientIdRef");
      }
      if (!String(connection?.tenantIdRef || "").trim()) {
        missing.push("connection.tenantIdRef");
      }
      if (!String(connection?.keychainRef || "").trim()) {
        missing.push("connection.keychainRef");
      }
      if (!siteUrl) {
        missing.push("context.graph.sharePointSiteUrl");
      }

      res.json({
        envId,
        town: environment.town,
        github: {
          ready: Boolean(remoteTarget?.originRemote && remoteTarget?.targetFilePath),
          target: remoteTarget
        },
        sharepoint: {
          ready: missing.length === 0,
          missing,
          siteUrl,
          graphBaseUrl: normalizeGraphBaseUrl(context.graph?.graphBaseUrl),
          tenantDomain: tenantDomain || "",
          libraryDefault: "Documents"
        }
      });
    } catch (error) {
      const status = Number(error?.status || 500);
      res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/veritas/remote/github/deploy", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const envId = String(req.body?.environmentId || "").trim();
    const reason = String(req.body?.reason || "").trim();

    if (!envId) {
      res.status(400).json({ error: "environmentId is required." });
      return;
    }

    try {
      const { environment } = await loadEnvironmentRemoteScope(config, envId, operator);
      const target = runtime.activeTarget;
      if (!target?.targetFilePath || !target?.repoRoot) {
        throw createHttpError(500, "Active deploy target is not configured.");
      }

      const execution = await execFileCommand(config.deployScriptPath, [], {
        cwd: config.appRoot,
        timeoutMs: config.deployTimeoutMs,
        env: {
          ...process.env,
          CONTENT_FILE_PATH: target.targetFilePath,
          DEPLOY_REPO_ROOT: target.repoRoot
        }
      });

      const now = new Date().toISOString();
      const commitSha = typeof getGitHeadSha === "function" ? await getGitHeadSha(target.repoRoot) : null;
      const result = execution.ok ? "success" : "error";
      const relativeFilePath = path.relative(target.repoRoot, target.targetFilePath).split(path.sep).join("/");

      const auditEntry = await appendAuditEntry(config.auditLogPath, {
        id: `remote-gh-${crypto.randomUUID()}`,
        timestamp: now,
        operator,
        user: operator,
        action_type: "remote:github_deploy",
        environment_id: envId,
        town: environment.town,
        target_repo: target.repoName,
        target_branch: target.branch,
        target_file: relativeFilePath,
        git_commit_sha: commitSha,
        reason: reason || "Remote deploy request",
        result,
        stdout_excerpt: excerpt(execution.stdout),
        stderr_excerpt: excerpt(execution.stderr)
      });

      if (!execution.ok) {
        throw createHttpError(
          500,
          `GitHub deploy remote failed. ${excerpt(execution.stderr) || "Check deploy script output."}`
        );
      }

      res.json({
        ok: true,
        environmentId: envId,
        town: environment.town,
        commitSha,
        target: {
          repoName: target.repoName,
          branch: target.branch,
          relativeFilePath,
          originRemote: target.originRemote
        },
        output: excerpt(execution.stdout, 1200),
        auditEntry
      });
    } catch (error) {
      const status = Number(error?.status || 500);
      res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/veritas/remote/sharepoint/folder", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const envId = String(req.body?.environmentId || "").trim();
    const libraryName = String(req.body?.libraryName || "Documents").trim();
    const folderPath = String(req.body?.folderPath || "").trim();

    if (!envId) {
      res.status(400).json({ error: "environmentId is required." });
      return;
    }
    if (!folderPath) {
      res.status(400).json({ error: "folderPath is required." });
      return;
    }

    try {
      const sharePoint = await resolveSharePointSession({
        config,
        environmentId: envId,
        operator,
        libraryName
      });
      const folderSegments = parsePathSegments(folderPath);
      if (folderSegments.length === 0) {
        throw createHttpError(400, "folderPath must include at least one segment.");
      }

      const folderResult = await ensureDriveFolderPath({
        accessToken: sharePoint.accessToken,
        graphBaseUrl: sharePoint.graphBaseUrl,
        driveId: sharePoint.drive.id,
        folderSegments
      });

      const now = new Date().toISOString();
      const payload = {
        ok: true,
        environmentId: envId,
        town: sharePoint.environment.town,
        siteUrl: sharePoint.siteUrl,
        siteId: sharePoint.site.id,
        driveId: sharePoint.drive.id,
        libraryName: sharePoint.drive.name,
        folderPath: folderResult.relativePath,
        webUrl: folderResult.folderItem?.webUrl || ""
      };

      await appendAuditEntry(config.auditLogPath, {
        id: `remote-sp-folder-${crypto.randomUUID()}`,
        timestamp: now,
        operator,
        user: operator,
        action_type: "remote:sharepoint_folder",
        environment_id: envId,
        town: sharePoint.environment.town,
        result: "success",
        detail: payload,
        stdout_excerpt: `Created folder path '${payload.folderPath}' in '${payload.libraryName}'.`,
        stderr_excerpt: ""
      });

      res.status(201).json(payload);
    } catch (error) {
      const status = Number(error?.status || 500);
      res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/veritas/remote/sharepoint/document", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const envId = String(req.body?.environmentId || "").trim();
    const libraryName = String(req.body?.libraryName || "Documents").trim();
    const folderPath = String(req.body?.folderPath || "").trim();
    const documentName = sanitizeDocumentName(String(req.body?.documentName || "").trim(), "remote-note");
    const content = String(req.body?.content || "").trim();

    if (!envId) {
      res.status(400).json({ error: "environmentId is required." });
      return;
    }

    try {
      const sharePoint = await resolveSharePointSession({
        config,
        environmentId: envId,
        operator,
        libraryName
      });
      const folderSegments = parsePathSegments(folderPath);
      await ensureDriveFolderPath({
        accessToken: sharePoint.accessToken,
        graphBaseUrl: sharePoint.graphBaseUrl,
        driveId: sharePoint.drive.id,
        folderSegments
      });

      const relativeDocumentPath = [...folderSegments, documentName].join("/");
      const encodedDocumentPath = encodeGraphPath(relativeDocumentPath);
      const upload = await graphRequest({
        accessToken: sharePoint.accessToken,
        graphBaseUrl: sharePoint.graphBaseUrl,
        requestPath: `/drives/${sharePoint.drive.id}/root:/${encodedDocumentPath}:/content`,
        method: "PUT",
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        },
        body: `${content || "Generated by Tenebrux Veritas remote control."}\n`
      });

      const now = new Date().toISOString();
      const payload = {
        ok: true,
        environmentId: envId,
        town: sharePoint.environment.town,
        siteUrl: sharePoint.siteUrl,
        siteId: sharePoint.site.id,
        driveId: sharePoint.drive.id,
        libraryName: sharePoint.drive.name,
        documentName,
        documentPath: relativeDocumentPath,
        webUrl: upload?.webUrl || ""
      };

      await appendAuditEntry(config.auditLogPath, {
        id: `remote-sp-doc-${crypto.randomUUID()}`,
        timestamp: now,
        operator,
        user: operator,
        action_type: "remote:sharepoint_document",
        environment_id: envId,
        town: sharePoint.environment.town,
        result: "success",
        detail: payload,
        stdout_excerpt: `Created document '${payload.documentPath}' in '${payload.libraryName}'.`,
        stderr_excerpt: ""
      });

      res.status(201).json(payload);
    } catch (error) {
      const status = Number(error?.status || 500);
      res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/veritas/remote/sharepoint/page", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const envId = String(req.body?.environmentId || "").trim();
    const pageTitle = String(req.body?.pageTitle || "").trim();
    const pageName = ensureAspxName(String(req.body?.pageName || "").trim(), pageTitle);
    const pageContent = String(req.body?.content || "").trim();

    if (!envId) {
      res.status(400).json({ error: "environmentId is required." });
      return;
    }
    if (!pageTitle) {
      res.status(400).json({ error: "pageTitle is required." });
      return;
    }

    try {
      const sharePoint = await resolveSharePointSession({
        config,
        environmentId: envId,
        operator,
        libraryName: "Site Pages"
      });

      let createdMode = "graph-site-page";
      let pageWebUrl = "";
      let pageId = "";

      try {
        const pageResult = await graphRequest({
          accessToken: sharePoint.accessToken,
          graphBaseUrl: sharePoint.graphBaseUrl,
          requestPath: `/sites/${sharePoint.site.id}/pages`,
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            "@odata.type": "#microsoft.graph.sitePage",
            name: pageName,
            title: pageTitle,
            pageLayout: "article",
            showComments: true,
            showRecommendedPages: false
          })
        });
        pageWebUrl = String(pageResult?.webUrl || "");
        pageId = String(pageResult?.id || "");
      } catch {
        createdMode = "site-pages-file";
        const html = createBasicPageHtml({ title: pageTitle, body: pageContent });
        const encodedPagePath = encodeGraphPath(pageName);
        const fileResult = await graphRequest({
          accessToken: sharePoint.accessToken,
          graphBaseUrl: sharePoint.graphBaseUrl,
          requestPath: `/drives/${sharePoint.drive.id}/root:/${encodedPagePath}:/content`,
          method: "PUT",
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          },
          body: `${html}\n`
        });
        pageWebUrl = String(fileResult?.webUrl || "");
        pageId = String(fileResult?.id || "");
      }

      const now = new Date().toISOString();
      const payload = {
        ok: true,
        environmentId: envId,
        town: sharePoint.environment.town,
        siteUrl: sharePoint.siteUrl,
        siteId: sharePoint.site.id,
        driveId: sharePoint.drive.id,
        libraryName: sharePoint.drive.name,
        pageTitle,
        pageName,
        mode: createdMode,
        pageId,
        webUrl: pageWebUrl
      };

      await appendAuditEntry(config.auditLogPath, {
        id: `remote-sp-page-${crypto.randomUUID()}`,
        timestamp: now,
        operator,
        user: operator,
        action_type: "remote:sharepoint_page",
        environment_id: envId,
        town: sharePoint.environment.town,
        result: "success",
        detail: payload,
        stdout_excerpt: `Created page '${payload.pageName}' (${payload.mode}).`,
        stderr_excerpt: ""
      });

      res.status(201).json(payload);
    } catch (error) {
      const status = Number(error?.status || 500);
      res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/veritas/governance-diff", requireOperatorAuth, async (req, res) => {
    const environmentId = String(req.body?.environmentId || "").trim();
    const selectedModules = uniqueStrings(req.body?.modules);
    const { environment } = await loadEnvironmentById(config.veritasEnvironmentsPath, environmentId);
    if (!environment) {
      res.status(404).json({ error: "Environment not found." });
      return;
    }

    const contextFilePath = createContextFilePath(config.veritasDeploymentContextsDir, environmentId);
    const context = normalizeContextPayload(
      await readJson(contextFilePath, { ...DEFAULT_CONTEXT }),
      req.session.user.username
    );
    const contextValidationIssues = validateContextPayloadDetailed(context);
    if (contextValidationIssues.length > 0) {
      res.status(422).json({
        error: "Deployment context requires completion before governance diff.",
        errors: contextValidationIssues.map((issue) => issue.message),
        fieldErrors: contextValidationIssues,
        schema: DEPLOYMENT_CONTEXT_SCHEMA
      });
      return;
    }
    const canon = await readJson(config.veritasCanonPath, { foundations: [], workspaces: [] });
    const requestedModules =
      selectedModules.length > 0 ? selectedModules : uniqueStrings(context.selectedModules);

    const diff = buildGovernanceDiff({
      environment,
      context,
      canon,
      selectedModules: requestedModules
    });

    runtime.veritasDiffCache.set(diff.diffId, {
      createdAt: Date.now(),
      environmentId,
      selectedModules: requestedModules,
      contextHash: JSON.stringify(context),
      warnings: diff.warnings,
      blockers: diff.blockers,
      diff
    });

    res.json(diff);
  });

  router.post("/veritas/deploy", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const environmentId = String(req.body?.environmentId || "").trim();
    const diffId = String(req.body?.diffId || "").trim();
    const confirmPhrase = String(req.body?.confirmPhrase || "").trim().toLowerCase();
    const acknowledgedWarnings = parseAcknowledgments(req.body?.acknowledgedWarnings);
    const selectedModules = uniqueStrings(req.body?.modules);

    const { environments, environment } = await loadEnvironmentById(config.veritasEnvironmentsPath, environmentId);
    if (!environment) {
      res.status(404).json({ error: "Environment not found." });
      return;
    }

    const contextFilePath = createContextFilePath(config.veritasDeploymentContextsDir, environmentId);
    const context = normalizeContextPayload(
      await readJson(contextFilePath, { ...DEFAULT_CONTEXT }),
      operator
    );
    const contextIssues = validateContextPayloadDetailed(context);
    const contextErrors = contextIssues.map((issue) => issue.message);

    const canon = await readJson(config.veritasCanonPath, { foundations: [], workspaces: [] });
    const modulesToDeploy = selectedModules.length > 0 ? selectedModules : uniqueStrings(context.selectedModules);
    const dependencyStatus = computeDependencyStatus({
      canon,
      selectedModules: modulesToDeploy,
      existingModules: environment.modules
    });
    const expectedPhrase = createDeployPhrase(environment.town);
    const diffRecord = runtime.veritasDiffCache.get(diffId);
    const blockers = [];

    if (modulesToDeploy.length === 0) {
      blockers.push("No modules selected for deployment.");
    }
    if (contextErrors.length > 0) {
      blockers.push(...contextErrors);
    }
    if (dependencyStatus.selectedWorkspaces.length > 0 && !dependencyStatus.allFoundationsPresent) {
      blockers.push(
        `Workspace deployment blocked until all Foundations are present. Missing: ${dependencyStatus.missingFoundations.join(", ")}.`
      );
    }
    if (!dependencyStatus.dependenciesMet) {
      for (const missing of dependencyStatus.missingDependencies) {
        blockers.push(`${missing.workspace} missing dependencies: ${missing.missing.join(", ")}.`);
      }
    }
    if (!dependencyStatus.canonCompliant) {
      blockers.push(`Unknown modules selected: ${dependencyStatus.unknownModules.join(", ")}.`);
    }
    if (!diffRecord || diffRecord.environmentId !== environmentId) {
      blockers.push("Governance diff approval is missing or stale. Regenerate review before deploy.");
    } else {
      if (diffRecord.contextHash !== JSON.stringify(context)) {
        blockers.push("Deployment context changed after diff generation. Regenerate governance diff.");
      }
      if (diffRecord.blockers.length > 0) {
        blockers.push("Governance diff contains unresolved blockers.");
      }
      const expectedWarnings = uniqueStrings(diffRecord.warnings);
      const unacked = expectedWarnings.filter((warning) => !acknowledgedWarnings.includes(warning));
      if (unacked.length > 0) {
        blockers.push("All governance warnings must be acknowledged before deploy.");
      }
    }
    if (confirmPhrase !== expectedPhrase) {
      blockers.push(`Confirmation phrase mismatch. Expected '${expectedPhrase}'.`);
    }

    if (blockers.length > 0) {
      res.status(422).json({
        error: "Deployment blocked.",
        blockers,
        fieldErrors: contextIssues,
        schema: DEPLOYMENT_CONTEXT_SCHEMA
      });
      return;
    }

    const deploymentId = `d-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const environmentIndex = environments.findIndex((entry) => entry.id === environmentId && !entry.archived);
    const mergedModules = uniqueStrings([...environment.modules, ...modulesToDeploy]);
    environments[environmentIndex] = {
      ...environment,
      modules: mergedModules,
      status: "active",
      health: "nominal",
      lastDeploy: now,
      operator
    };
    await writeJson(config.veritasEnvironmentsPath, environments);

    const deploymentSummary = {
      deploymentId,
      environmentId,
      town: environment.town,
      status: "completed",
      mode: context.graph.authRef ? "graph-ready" : "simulation",
      createdStructures: diffRecord.diff.structures.length,
      createdLibraries: diffRecord.diff.libraries.length,
      createdFlows: diffRecord.diff.flows.length,
      timestamp: now
    };

    const memoryEntry = {
      id: `m-${crypto.randomUUID().slice(0, 10)}`,
      envId: environmentId,
      date: now,
      operator,
      type: "deployment",
      content: `${environment.town}: deployed modules ${modulesToDeploy.join(", ")}.`,
      deploymentId,
      summary: deploymentSummary
    };
    await appendJsonLine(config.veritasMemoryPath, memoryEntry);

    const gitSha = typeof getGitHeadSha === "function" ? await getGitHeadSha(config.appRoot) : null;
    const actionType = actionTypeFromModules(canon, modulesToDeploy);
    const auditEntry = await appendAuditEntry(config.auditLogPath, {
      id: deploymentId,
      timestamp: now,
      operator,
      user: operator,
      action_type: actionType,
      environment_id: environmentId,
      town: environment.town,
      modules: modulesToDeploy,
      git_commit_sha: gitSha,
      result: "success",
      governance_diff_snapshot: diffRecord.diff,
      deployment_context_snapshot: context,
      warning_acknowledgments: acknowledgedWarnings,
      confirm_phrase: confirmPhrase,
      stdout_excerpt: "Tenebrux Veritas deployment simulation completed.",
      stderr_excerpt: ""
    });

    runtime.veritasDiffCache.delete(diffId);

    res.json({
      ok: true,
      deploymentId,
      summary: deploymentSummary,
      memoryEntry,
      auditEntry
    });
  });

  router.get("/veritas/memory", requireOperatorAuth, async (req, res) => {
    const entries = await readJsonLines(config.veritasMemoryPath);
    const filtered = filterEntries(entries, {
      envId: req.query.envId,
      type: req.query.type,
      q: req.query.q
    }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    res.json({ entries: filtered });
  });

  router.get("/veritas/memory/:envId", requireOperatorAuth, async (req, res) => {
    const entries = await readJsonLines(config.veritasMemoryPath);
    const filtered = filterEntries(entries, { envId: req.params.envId }).sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );
    res.json({ entries: filtered });
  });

  router.post("/veritas/memory", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const envId = String(req.body?.envId || "").trim();
    const type = String(req.body?.type || "").trim().toLowerCase();
    const content = String(req.body?.content || "").trim();
    if (!envId) {
      res.status(400).json({ error: "envId is required." });
      return;
    }
    if (!MEMORY_TYPES.has(type)) {
      res.status(400).json({ error: "type must be deployment, note, quirk, or decision." });
      return;
    }
    if (!content) {
      res.status(400).json({ error: "content is required." });
      return;
    }

    const entry = {
      id: `m-${crypto.randomUUID().slice(0, 10)}`,
      envId,
      date: new Date().toISOString(),
      operator,
      type,
      content
    };
    await appendJsonLine(config.veritasMemoryPath, entry);

    await appendAuditEntry(config.auditLogPath, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      operator,
      user: operator,
      action_type: "memory:add",
      environment_id: envId,
      result: "success",
      detail: { type, content },
      stdout_excerpt: "",
      stderr_excerpt: ""
    });

    res.status(201).json(entry);
  });

  router.get("/veritas/audit", requireOperatorAuth, async (req, res) => {
    const entries = await readAuditEntries(config.auditLogPath);
    const envId = String(req.query.envId || "").trim();
    const actionType = String(req.query.actionType || "").trim().toLowerCase();
    const filtered = entries
      .filter((entry) => (envId ? String(entry.environment_id || "") === envId : true))
      .filter((entry) =>
        actionType ? String(entry.action_type || "").toLowerCase() === actionType : true
      )
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
    res.json({ entries: filtered });
  });

  router.get("/veritas/audit/:envId", requireOperatorAuth, async (req, res) => {
    const entries = await readAuditEntries(config.auditLogPath);
    const envId = String(req.params.envId || "").trim();
    const filtered = entries
      .filter((entry) => String(entry.environment_id || "") === envId)
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
    res.json({ entries: filtered });
  });

  router.get("/veritas/proof/:envId", requireOperatorAuth, async (req, res) => {
    const envId = String(req.params.envId || "").trim();
    if (!envId) {
      res.status(400).json({ error: "envId is required." });
      return;
    }
    const { environment } = await loadEnvironmentById(config.veritasEnvironmentsPath, envId);
    if (!environment) {
      res.status(404).json({ error: "Environment not found." });
      return;
    }

    const rootPath = buildProofRootPath(config, envId);
    await fs.mkdir(rootPath, { recursive: true });
    const logPath = buildProofLogPath(config);
    const entries = (await readJsonLines(logPath))
      .filter((entry) => String(entry.envId || "") === envId)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    res.json({
      envId,
      town: environment.town,
      rootPath,
      entries
    });
  });

  router.post("/veritas/proof/folder", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const envId = String(req.body?.envId || "").trim();
    const requestedFolderName = String(req.body?.folderName || "").trim();

    if (!envId) {
      res.status(400).json({ error: "envId is required." });
      return;
    }

    const { environment } = await loadEnvironmentById(config.veritasEnvironmentsPath, envId);
    if (!environment) {
      res.status(404).json({ error: "Environment not found." });
      return;
    }

    const rootPath = buildProofRootPath(config, envId);
    await fs.mkdir(rootPath, { recursive: true });

    const folderName = sanitizeSegment(
      requestedFolderName || `${environment.town}-proof-${new Date().toISOString().slice(0, 10)}`,
      "proof-folder"
    );
    const folderPath = path.join(rootPath, folderName);

    if (!isPathInside(rootPath, folderPath)) {
      res.status(400).json({ error: "Folder path is invalid." });
      return;
    }

    await fs.mkdir(folderPath, { recursive: true });

    const entry = {
      ...buildProofEntryBase({ envId, town: environment.town, operator, type: "folder" }),
      folderName,
      folderPath,
      relativePath: path.relative(config.dataDir, folderPath).split(path.sep).join("/")
    };

    await appendJsonLine(buildProofLogPath(config), entry);
    await appendAuditEntry(config.auditLogPath, {
      id: crypto.randomUUID(),
      timestamp: entry.createdAt,
      operator,
      user: operator,
      action_type: "proof:create_folder",
      environment_id: envId,
      town: environment.town,
      result: "success",
      detail: {
        folderName: entry.folderName,
        relativePath: entry.relativePath
      },
      stdout_excerpt: "Proof folder created.",
      stderr_excerpt: ""
    });

    res.status(201).json(entry);
  });

  router.post("/veritas/proof/document", requireOperatorAuth, async (req, res) => {
    const operator = req.session.user.username;
    const envId = String(req.body?.envId || "").trim();
    const requestedFolderName = String(req.body?.folderName || "").trim();
    const requestedDocumentName = String(req.body?.documentName || "").trim();
    const requestedContent = String(req.body?.content || "").trim();

    if (!envId) {
      res.status(400).json({ error: "envId is required." });
      return;
    }

    const { environment } = await loadEnvironmentById(config.veritasEnvironmentsPath, envId);
    if (!environment) {
      res.status(404).json({ error: "Environment not found." });
      return;
    }

    const rootPath = buildProofRootPath(config, envId);
    await fs.mkdir(rootPath, { recursive: true });

    const folderName = sanitizeSegment(requestedFolderName || "proof-documents", "proof-documents");
    const folderPath = path.join(rootPath, folderName);
    if (!isPathInside(rootPath, folderPath)) {
      res.status(400).json({ error: "Document folder path is invalid." });
      return;
    }
    await fs.mkdir(folderPath, { recursive: true });

    const documentName = sanitizeDocumentName(
      requestedDocumentName || `${environment.town}-proof-${new Date().toISOString().slice(0, 10)}`,
      "proof-note"
    );
    const documentPath = path.join(folderPath, documentName);
    if (!isPathInside(rootPath, documentPath)) {
      res.status(400).json({ error: "Document path is invalid." });
      return;
    }

    const content =
      requestedContent ||
      [
        `# Proof Document`,
        ``,
        `Environment: ${environment.town} (${envId})`,
        `Operator: ${operator}`,
        `Timestamp: ${new Date().toISOString()}`,
        ``,
        `This document was created by Tenebrux Veritas proof flow.`
      ].join("\n");
    await fs.writeFile(documentPath, `${content}\n`, "utf8");

    const entry = {
      ...buildProofEntryBase({ envId, town: environment.town, operator, type: "document" }),
      folderName,
      documentName,
      documentPath,
      bytes: Buffer.byteLength(content, "utf8"),
      relativePath: path.relative(config.dataDir, documentPath).split(path.sep).join("/")
    };

    await appendJsonLine(buildProofLogPath(config), entry);
    await appendAuditEntry(config.auditLogPath, {
      id: crypto.randomUUID(),
      timestamp: entry.createdAt,
      operator,
      user: operator,
      action_type: "proof:create_document",
      environment_id: envId,
      town: environment.town,
      result: "success",
      detail: {
        documentName: entry.documentName,
        folderName: entry.folderName,
        relativePath: entry.relativePath,
        bytes: entry.bytes
      },
      stdout_excerpt: "Proof document created.",
      stderr_excerpt: ""
    });

    res.status(201).json(entry);
  });

  router.get("/health-summary", requireOperatorAuth, (_req, res) => {
    try {
      const environments = getDashboardEnvironments();
      const healthData = environments.map((environment) => ({
        ...environment,
        health: calculateDashboardEnvironmentHealth(environment)
      }));

      const summary = {
        totalContexts: environments.length,
        healthyContexts: healthData.filter((item) => item.health.overall === "healthy").length,
        warningContexts: healthData.filter((item) => item.health.overall === "warning").length,
        errorContexts: healthData.filter((item) => item.health.overall === "error").length,
        criticalAlerts: healthData.reduce(
          (total, item) => total + (Array.isArray(item.health.issues) ? item.health.issues.length : 0),
          0
        ),
        deploymentsToday: 0
      };

      const today = new Date().toDateString();
      const allDeployments = getDashboardRecentDeployments(null, 250);
      summary.deploymentsToday = allDeployments.filter((deployment) => {
        const deploymentDate = new Date(String(deployment.timestamp || ""));
        return !Number.isNaN(deploymentDate.getTime()) && deploymentDate.toDateString() === today;
      }).length;

      res.json(summary);
    } catch (error) {
      console.error("Tenebrux Veritas: Error calculating health summary", error);
      res.status(500).json({ error: "Failed to calculate health summary." });
    }
  });

  router.get("/upcoming-deadlines", requireOperatorAuth, (_req, res) => {
    try {
      const deadlines = getDashboardUpcomingDeadlines();
      res.json({ deadlines });
    } catch (error) {
      console.error("Tenebrux Veritas: Error loading upcoming deadlines", error);
      res.status(500).json({ error: "Failed to load upcoming deadlines." });
    }
  });

  router.get("/environments", requireOperatorAuth, (_req, res) => {
    try {
      const environments = getDashboardEnvironments().map((environment) => ({
        ...environment,
        health: calculateDashboardEnvironmentHealth(environment),
        lastDeployment: getDashboardRecentDeployments(environment.targetId, 1)[0] || null
      }));
      res.json({ environments });
    } catch (error) {
      console.error("Tenebrux Veritas: Error listing dashboard environments", error);
      res.status(500).json({ error: "Failed to list environments." });
    }
  });

  router.get("/environments/:targetId", requireOperatorAuth, (req, res) => {
    try {
      const targetId = String(req.params.targetId || "").trim();
      const environment = getDashboardEnvironmentById(targetId);

      if (!environment) {
        res.status(404).json({ error: "Environment not found." });
        return;
      }

      const deploymentState = getDashboardDeploymentState();
      const recentDeployments = getDashboardRecentDeployments(environment.targetId, 10);

      res.json({
        ...environment,
        health: calculateDashboardEnvironmentHealth(environment),
        recentDeployments,
        deploymentState
      });
    } catch (error) {
      console.error("Tenebrux Veritas: Error loading dashboard environment", error);
      res.status(500).json({ error: "Failed to load environment." });
    }
  });

  return router;
}
