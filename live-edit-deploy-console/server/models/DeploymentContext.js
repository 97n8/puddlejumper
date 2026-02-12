const ENVIRONMENTS = new Set(["test", "pilot", "production"]);
const AUTHORITY_ROLES = new Set(["admin", "editor", "reviewer", "viewer"]);
const CONNECTOR_TYPES = new Set([
  "google_workspace",
  "github",
  "civicplus",
  "other"
]);
const CONNECTOR_STATUSES = new Set([
  "healthy",
  "degraded",
  "failed",
  "not_configured"
]);

function clean(value) {
  return String(value || "").trim();
}

function normalizeEnvironment(value) {
  const candidate = clean(value).toLowerCase();
  if (candidate === "sandbox") {
    return "test";
  }
  return candidate;
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function normalizeAuthorityMapping(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => ({
    userId: clean(entry?.userId),
    userName: clean(entry?.userName),
    email: clean(entry?.email),
    role: clean(entry?.role).toLowerCase(),
    grantedBy: clean(entry?.grantedBy),
    grantedDate: toIsoOrNull(entry?.grantedDate),
    expirationDate: toIsoOrNull(entry?.expirationDate),
    justification: clean(entry?.justification)
  }));
}

function normalizeConnectors(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => ({
    type: clean(entry?.type).toLowerCase(),
    status: clean(entry?.status).toLowerCase(),
    lastSync: toIsoOrNull(entry?.lastSync),
    lastError: clean(entry?.lastError),
    tokenExpires: toIsoOrNull(entry?.tokenExpires)
  }));
}

function normalizeOptionalModules(optionalModules) {
  return {
    permittingWorkspace: Boolean(optionalModules?.permittingWorkspace),
    publicRecordsWorkspace: Boolean(optionalModules?.publicRecordsWorkspace),
    boardComplianceWorkspace: Boolean(optionalModules?.boardComplianceWorkspace),
    appointmentsWorkspace: Boolean(optionalModules?.appointmentsWorkspace)
  };
}

/**
 * DeploymentContext Schema
 *
 * Stored as: data/contexts/{contextId}.json
 */
export const DeploymentContextSchema = {
  /** Unique context ID, e.g. ctx_westminster_prod_2024 */
  contextId: "string",
  /** Human name, e.g. Westminster, MA */
  clientName: "string",
  /** Typed confirmation alias, e.g. westminster */
  clientShortName: "string",
  /** Environment boundary: test/pilot/production */
  deploymentEnvironment: "string",
  /** Microsoft tenant ID */
  tenantId: "string",
  /** SharePoint root URL for this tenant */
  sharePointRootUrl: "string",
  /** Canonical GitHub repository URL */
  canonicalRepoUrl: "string",
  /** Local repository path when applicable */
  canonicalRepoPath: "string",
  /** Authority mapping entries */
  authorityMapping: "array",
  /** Connector health entries */
  activeConnectors: "array",
  /** Primary municipal contact */
  primaryMunicipalContact: "object",
  /** Optional modules from Veritas deployment context */
  optionalModules: "object",
  /** Creation timestamp */
  createdAt: "string",
  /** Operator that created context */
  createdBy: "string",
  /** Last modification timestamp */
  lastModified: "string",
  /** Operator that last modified context */
  modifiedBy: "string",
  /** Schema version for migration */
  version: "number"
};

export function normalizeContext(rawContext, { contextId = "", operator = "" } = {}) {
  const source = rawContext && typeof rawContext === "object" ? rawContext : {};
  const now = new Date().toISOString();

  const normalized = {
    contextId: clean(source.contextId || contextId),
    clientName: clean(source.clientName),
    clientShortName: clean(source.clientShortName).toLowerCase(),
    deploymentEnvironment: normalizeEnvironment(source.deploymentEnvironment),
    tenantId: clean(source.tenantId),
    sharePointRootUrl: clean(source.sharePointRootUrl),
    canonicalRepoUrl: clean(source.canonicalRepoUrl),
    canonicalRepoPath: clean(source.canonicalRepoPath),
    authorityMapping: normalizeAuthorityMapping(source.authorityMapping),
    activeConnectors: normalizeConnectors(source.activeConnectors),
    primaryMunicipalContact: {
      name: clean(source.primaryMunicipalContact?.name),
      email: clean(source.primaryMunicipalContact?.email),
      phone: clean(source.primaryMunicipalContact?.phone)
    },
    optionalModules: normalizeOptionalModules(source.optionalModules),
    createdAt: toIsoOrNull(source.createdAt) || now,
    createdBy: clean(source.createdBy || operator),
    lastModified: toIsoOrNull(source.lastModified) || now,
    modifiedBy: clean(source.modifiedBy || operator),
    version: Number.isFinite(Number(source.version)) ? Number(source.version) : 1
  };

  if (!normalized.contextId && normalized.clientName && normalized.deploymentEnvironment) {
    normalized.contextId = generateContextId(
      normalized.clientName,
      normalized.deploymentEnvironment
    );
  }

  return normalized;
}

/**
 * Validate deployment context.
 * @param {object} context
 * @returns {string[]} error strings
 */
export function validateContext(context) {
  const candidate = normalizeContext(context);
  const errors = [];

  if (!candidate.clientName) {
    errors.push("Client name is required");
  }
  if (!candidate.clientShortName) {
    errors.push("Client short name is required");
  }
  if (!candidate.deploymentEnvironment) {
    errors.push("Environment is required");
  }
  if (!candidate.tenantId) {
    errors.push("Microsoft tenant ID is required");
  }

  if (candidate.deploymentEnvironment && !ENVIRONMENTS.has(candidate.deploymentEnvironment)) {
    errors.push(
      `Invalid environment. Must be one of: ${Array.from(ENVIRONMENTS).join(", ")}`
    );
  }

  if (candidate.clientShortName && !/^[a-z0-9-]+$/.test(candidate.clientShortName)) {
    errors.push(
      "Client short name must be lowercase letters, numbers, and hyphens only"
    );
  }

  for (const [index, authority] of candidate.authorityMapping.entries()) {
    if (authority.role && !AUTHORITY_ROLES.has(authority.role)) {
      errors.push(
        `Authority mapping #${index + 1} has invalid role '${authority.role}'. Valid: ${Array.from(
          AUTHORITY_ROLES
        ).join(", ")}`
      );
    }
  }

  for (const [index, connector] of candidate.activeConnectors.entries()) {
    if (connector.type && !CONNECTOR_TYPES.has(connector.type)) {
      errors.push(
        `Connector #${index + 1} has invalid type '${connector.type}'.`
      );
    }
    if (connector.status && !CONNECTOR_STATUSES.has(connector.status)) {
      errors.push(
        `Connector #${index + 1} has invalid status '${connector.status}'.`
      );
    }
  }

  return errors;
}

/**
 * Generate context ID from client name + environment.
 */
export function generateContextId(clientName, environment) {
  const slug = String(clientName || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const year = new Date().getFullYear();
  const normalizedEnvironment = normalizeEnvironment(environment || "test") || "test";
  return `ctx_${slug || "client"}_${normalizedEnvironment}_${year}`;
}

/**
 * Convert new context schema to existing Veritas deployment context shape.
 * This lets current governance/diff/deploy logic run without rewrite.
 */
export function toLegacyDeploymentContext(context) {
  const candidate = normalizeContext(context);

  const authorityGroups = {
    authorityGroup: "",
    operatorsGroup: "",
    readOnlyGroup: ""
  };

  for (const entry of candidate.authorityMapping) {
    const label = entry.email || entry.userName || entry.userId;
    if (!label) {
      continue;
    }

    if (entry.role === "admin" && !authorityGroups.authorityGroup) {
      authorityGroups.authorityGroup = label;
    } else if (
      (entry.role === "editor" || entry.role === "reviewer") &&
      !authorityGroups.operatorsGroup
    ) {
      authorityGroups.operatorsGroup = label;
    } else if (entry.role === "viewer" && !authorityGroups.readOnlyGroup) {
      authorityGroups.readOnlyGroup = label;
    }
  }

  return {
    clientShortName: candidate.clientShortName,
    clientFormalName: candidate.clientName,
    environmentType: candidate.deploymentEnvironment === "test" ? "sandbox" : candidate.deploymentEnvironment,
    primaryMunicipalContact: {
      name: candidate.primaryMunicipalContact.name,
      email: candidate.primaryMunicipalContact.email
    },
    microsoftTenantId: candidate.tenantId,
    authorityMapping: authorityGroups,
    optionalModules: normalizeOptionalModules(candidate.optionalModules)
  };
}

/**
 * Convert legacy deployment-context entry into a new multi-tenant context.
 */
export function fromLegacyDeploymentContext(legacyEntry, options = {}) {
  const context = legacyEntry && typeof legacyEntry === "object" ? legacyEntry : {};
  const targetId = clean(options.targetId || "legacy");
  const clientName = clean(context.clientFormalName || context.clientShortName || targetId || "Legacy Client");
  const deploymentEnvironment = normalizeEnvironment(context.environmentType || "production") || "production";
  const contextId = generateContextId(clientName, deploymentEnvironment);

  const authorityMapping = [];
  const authority = context.authorityMapping && typeof context.authorityMapping === "object"
    ? context.authorityMapping
    : {};

  if (clean(authority.authorityGroup)) {
    authorityMapping.push({
      userId: "",
      userName: authority.authorityGroup,
      email: "",
      role: "admin",
      grantedBy: clean(options.operator || "migration-script"),
      grantedDate: toIsoOrNull(options.updatedAt) || new Date().toISOString(),
      expirationDate: null,
      justification: "Migrated from legacy authorityGroup"
    });
  }

  if (clean(authority.operatorsGroup)) {
    authorityMapping.push({
      userId: "",
      userName: authority.operatorsGroup,
      email: "",
      role: "editor",
      grantedBy: clean(options.operator || "migration-script"),
      grantedDate: toIsoOrNull(options.updatedAt) || new Date().toISOString(),
      expirationDate: null,
      justification: "Migrated from legacy operatorsGroup"
    });
  }

  if (clean(authority.readOnlyGroup)) {
    authorityMapping.push({
      userId: "",
      userName: authority.readOnlyGroup,
      email: "",
      role: "viewer",
      grantedBy: clean(options.operator || "migration-script"),
      grantedDate: toIsoOrNull(options.updatedAt) || new Date().toISOString(),
      expirationDate: null,
      justification: "Migrated from legacy readOnlyGroup"
    });
  }

  return normalizeContext(
    {
      contextId,
      clientName,
      clientShortName: clean(context.clientShortName).toLowerCase(),
      deploymentEnvironment,
      tenantId: clean(context.microsoftTenantId),
      sharePointRootUrl: clean(context.microsoftTenantId),
      canonicalRepoUrl: "",
      canonicalRepoPath: "",
      authorityMapping,
      activeConnectors: [],
      primaryMunicipalContact: {
        name: clean(context.primaryMunicipalContact?.name),
        email: clean(context.primaryMunicipalContact?.email),
        phone: ""
      },
      optionalModules: normalizeOptionalModules(context.optionalModules),
      createdAt: toIsoOrNull(options.updatedAt) || new Date().toISOString(),
      createdBy: clean(options.operator || "migration-script"),
      lastModified: toIsoOrNull(options.updatedAt) || new Date().toISOString(),
      modifiedBy: clean(options.operator || "migration-script"),
      version: 1,
      _migratedFrom: targetId
    },
    { contextId, operator: clean(options.operator || "migration-script") }
  );
}
