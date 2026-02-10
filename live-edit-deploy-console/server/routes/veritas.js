import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import express from "express";

import { appendAuditEntry, readAuditEntries } from "../src/audit.js";

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

  return router;
}
