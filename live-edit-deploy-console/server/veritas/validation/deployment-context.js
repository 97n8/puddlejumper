const ENVIRONMENT_TYPES = new Set(["sandbox", "pilot", "production"]);
const SHORT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value) {
  return String(value || "").trim();
}

function normalizeModuleFlags(optionalModules) {
  return {
    permittingWorkspace: Boolean(optionalModules?.permittingWorkspace),
    publicRecordsWorkspace: Boolean(optionalModules?.publicRecordsWorkspace),
    boardComplianceWorkspace: Boolean(optionalModules?.boardComplianceWorkspace),
    appointmentsWorkspace: Boolean(optionalModules?.appointmentsWorkspace)
  };
}

export function normalizeDeploymentContext(rawContext) {
  const context = rawContext || {};
  return {
    clientShortName: clean(context.clientShortName),
    clientFormalName: clean(context.clientFormalName),
    environmentType: clean(context.environmentType),
    primaryMunicipalContact: {
      name: clean(context.primaryMunicipalContact?.name),
      email: clean(context.primaryMunicipalContact?.email)
    },
    microsoftTenantId: clean(context.microsoftTenantId),
    authorityMapping: {
      authorityGroup: clean(context.authorityMapping?.authorityGroup),
      operatorsGroup: clean(context.authorityMapping?.operatorsGroup),
      readOnlyGroup: clean(context.authorityMapping?.readOnlyGroup)
    },
    optionalModules: normalizeModuleFlags(context.optionalModules)
  };
}

export function validateDeploymentContext(rawContext) {
  const context = normalizeDeploymentContext(rawContext);
  const errors = [];

  if (!context.clientShortName) {
    errors.push("Veritas: Client short name is required.");
  } else if (!SHORT_NAME_PATTERN.test(context.clientShortName)) {
    errors.push("Veritas: Client short name must use slug format (example: sutton-ma).");
  }

  if (!context.clientFormalName) {
    errors.push("Veritas: Client formal name is required.");
  }

  if (!context.environmentType) {
    errors.push("Veritas: Environment type must be explicitly selected.");
  } else if (!ENVIRONMENT_TYPES.has(context.environmentType)) {
    errors.push("Veritas: Environment type must be sandbox, pilot, or production.");
  }

  if (!context.primaryMunicipalContact.name) {
    errors.push("Veritas: Primary municipal contact name is required.");
  }

  if (!context.primaryMunicipalContact.email) {
    errors.push("Veritas: Primary municipal contact email is required.");
  } else if (!SIMPLE_EMAIL_PATTERN.test(context.primaryMunicipalContact.email)) {
    errors.push("Veritas: Primary municipal contact email is invalid.");
  }

  if (!context.microsoftTenantId) {
    errors.push("Veritas: Microsoft Tenant ID is required.");
  }

  const authorityGroups = [
    context.authorityMapping.authorityGroup,
    context.authorityMapping.operatorsGroup,
    context.authorityMapping.readOnlyGroup
  ].filter(Boolean);

  if (authorityGroups.length < 1) {
    errors.push("Veritas: At least one authority mapping group must be specified.");
  }

  if (!context.authorityMapping.authorityGroup) {
    errors.push("Veritas: Authority group is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    context
  };
}

export function contextFingerprint(context) {
  const normalized = normalizeDeploymentContext(context);
  return JSON.stringify(normalized);
}

export function requiredContextChecklist(context) {
  return [
    {
      id: "context-client",
      label: "Client identity fields complete",
      ok: Boolean(context.clientShortName && context.clientFormalName)
    },
    {
      id: "context-contact",
      label: "Primary municipal contact complete",
      ok: Boolean(context.primaryMunicipalContact.name && context.primaryMunicipalContact.email)
    },
    {
      id: "context-tenant",
      label: "Microsoft tenant ID specified",
      ok: Boolean(context.microsoftTenantId)
    },
    {
      id: "context-groups",
      label: "Authority mapping configured",
      ok: Boolean(
        context.authorityMapping.authorityGroup ||
          context.authorityMapping.operatorsGroup ||
          context.authorityMapping.readOnlyGroup
      )
    },
    {
      id: "context-environment",
      label: "Environment type explicitly selected",
      ok: Boolean(context.environmentType)
    }
  ];
}
