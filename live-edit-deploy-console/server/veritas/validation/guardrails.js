function detectJsonMetadataConflicts(existingJson) {
  if (!existingJson || typeof existingJson !== "object") {
    return [];
  }

  const metadata = existingJson.metadata && typeof existingJson.metadata === "object"
    ? existingJson.metadata
    : existingJson;

  const canonicalFieldTypes = {
    client_short_name: "string",
    client_formal_name: "string",
    environment_type: "string",
    authority_group: "string",
    operators_group: "string",
    read_only_group: "string"
  };

  const conflicts = [];
  for (const [field, expectedType] of Object.entries(canonicalFieldTypes)) {
    if (!(field in metadata)) {
      continue;
    }

    const currentValue = metadata[field];
    const currentType = Array.isArray(currentValue) ? "array" : typeof currentValue;
    if (currentType !== expectedType) {
      conflicts.push({
        field,
        currentType,
        canonicalType: expectedType
      });
    }
  }

  return conflicts;
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function validateGroupPattern(groupName, expectedKeywords) {
  const candidate = String(groupName || "").toLowerCase();
  if (!candidate) {
    return true;
  }

  return expectedKeywords.some((keyword) => candidate.includes(keyword));
}

function evaluatePermissionGraph(context) {
  const checks = [];

  const authorityIsStandard = validateGroupPattern(context.authorityMapping.authorityGroup, [
    "authority",
    "town-admin",
    "administrator",
    "admin"
  ]);
  if (!authorityIsStandard) {
    checks.push("Authority group does not look like a standard Authority naming pattern.");
  }

  const operatorsIsStandard = validateGroupPattern(context.authorityMapping.operatorsGroup, [
    "operator",
    "department",
    "dept",
    "head"
  ]);
  if (!operatorsIsStandard) {
    checks.push("Operators group does not look like a standard Operators naming pattern.");
  }

  const readOnlyIsStandard = validateGroupPattern(context.authorityMapping.readOnlyGroup, [
    "read",
    "viewer",
    "view",
    "readonly"
  ]);
  if (!readOnlyIsStandard) {
    checks.push("Read-only group does not look like a standard Read-only naming pattern.");
  }

  return {
    standard: checks.length === 0,
    reasons: checks
  };
}

function buildProductionGuardrail(context) {
  if (context.environmentType !== "production") {
    return null;
  }

  return {
    id: "production-environment",
    severity: "warning",
    title: "Production Deployment",
    message:
      "You are deploying to a production environment. This will create permanent live governance structures.",
    checklist: [
      { id: "pilotValidationCompleted", label: "Pilot validation completed successfully" },
      { id: "clientSignoffReceived", label: "Client sign-off received" },
      { id: "trainingScheduled", label: "Training scheduled" }
    ]
  };
}

function buildMetadataGuardrail(conflicts) {
  if (!conflicts.length) {
    return null;
  }

  return {
    id: "metadata-overwrites",
    severity: "critical",
    title: "Existing Metadata Detected",
    message:
      "The target environment contains metadata fields that conflict with the PublicLogic Canon schema.",
    conflicts,
    checklist: [
      { id: "backupCompleted", label: "I have backed up existing content" },
      { id: "noDataLossValidated", label: "I have validated no data loss will occur" }
    ]
  };
}

function buildPermissionGuardrail(permissionEvaluation, context) {
  if (permissionEvaluation.standard) {
    return null;
  }

  return {
    id: "non-standard-permission-graph",
    severity: "warning",
    title: "Permission Verification Required",
    message:
      "Specified Authority/Operators/Read-only groups do not follow standard PublicLogic naming patterns.",
    details: {
      expected: "Authority=Town Administrators, Operators=Dept Heads, Read-only=Viewers",
      configured: context.authorityMapping,
      reasons: permissionEvaluation.reasons
    },
    checklist: [
      { id: "confirmNonStandardSetup", label: "I confirm this non-standard setup is intentional" }
    ]
  };
}

export function evaluateGuardrails({ context, existingTargetContent }) {
  const existingJson = parseJsonSafe(existingTargetContent);
  const metadataConflicts = detectJsonMetadataConflicts(existingJson);
  const permissionEvaluation = evaluatePermissionGraph(context);

  const guardrails = [
    buildProductionGuardrail(context),
    buildMetadataGuardrail(metadataConflicts),
    buildPermissionGuardrail(permissionEvaluation, context)
  ].filter(Boolean);

  const warningMessages = [];
  if (metadataConflicts.length > 0) {
    warningMessages.push(
      `Existing metadata conflicts detected (${metadataConflicts.length}). Existing content will be preserved until override is acknowledged.`
    );
  } else {
    warningMessages.push("Existing content in the target location will be preserved by default.");
  }

  return {
    guardrails,
    metadataConflicts,
    permissionEvaluation,
    warningMessages
  };
}

export function validateGuardrailAcknowledgments({ guardrails, acknowledgments }) {
  const errors = [];
  const normalizedAcks =
    acknowledgments && typeof acknowledgments === "object" ? acknowledgments : {};

  for (const guardrail of guardrails) {
    const entry = normalizedAcks[guardrail.id];
    if (!entry || typeof entry !== "object") {
      errors.push(`Veritas: Guardrail '${guardrail.title}' must be acknowledged.`);
      continue;
    }

    for (const item of guardrail.checklist) {
      if (entry[item.id] !== true) {
        errors.push(
          `Veritas: Guardrail '${guardrail.title}' requires confirmation '${item.label}'.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
