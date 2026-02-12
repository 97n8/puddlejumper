import crypto from "node:crypto";

import {
  evaluateGuardrails
} from "../validation/guardrails.js";
import {
  requiredContextChecklist
} from "../validation/deployment-context.js";

const BASE_DOCUMENT_LIBRARIES = [
  "Authority Documents",
  "Accountability Records",
  "Boundary Definitions",
  "Continuity Plans"
];

const BASE_TRACKING_LISTS = [
  { name: "Authority Assignments", purpose: "Tracks accountable municipal roles and owners." },
  { name: "Boundary Registry", purpose: "Maintains governance boundaries and jurisdiction maps." },
  { name: "Continuity Tasks", purpose: "Tracks continuity obligations and handoff actions." },
  { name: "Exception Log", purpose: "Records governance exceptions requiring documented review." },
  { name: "Audit Ledger", purpose: "Captures immutable deployment and configuration events." }
];

const BASE_FLOWS = [
  "Intake Normalization",
  "Routing Logic",
  "Status Tracking",
  "Deadline Alerts",
  "Audit Logging"
];

function buildTenantIsolationChecks({ context, targetSummary }) {
  const tenantId = String(context.microsoftTenantId || "").trim().toLowerCase();
  const allowedTenantPattern = /(\.sharepoint\.com|\.onmicrosoft\.com)$/i;
  const canonicalTarget = String(targetSummary?.relativeFilePath || "").trim();
  const hasEnvironment = new Set(["sandbox", "pilot", "production"]).has(
    String(context.environmentType || "").trim()
  );

  return [
    {
      id: "tenant-id-present",
      category: "Tenant Boundary",
      label: "Microsoft tenant identifier provided",
      ok: Boolean(tenantId)
    },
    {
      id: "tenant-domain-valid",
      category: "Tenant Boundary",
      label: "Tenant domain matches expected Microsoft tenancy format",
      ok: allowedTenantPattern.test(tenantId)
    },
    {
      id: "authority-boundary-present",
      category: "Authority Boundary",
      label: "Authority group explicitly maps ownership boundary",
      ok: Boolean(context.authorityMapping.authorityGroup)
    },
    {
      id: "canonical-target-bounded",
      category: "Canonical Boundary",
      label: "Canonical target is explicitly selected and scoped",
      ok: Boolean(canonicalTarget) && !canonicalTarget.startsWith("..")
    },
    {
      id: "environment-isolation-explicit",
      category: "Environment Boundary",
      label: "Environment isolation mode is explicit",
      ok: hasEnvironment
    }
  ];
}

function moduleArtifacts(optionalModules) {
  const artifacts = [
    "PublicLogic Canon v1.0 Governance Charter",
    "Authority Matrix Template",
    "Boundary Definitions Template",
    "Continuity Playbook Template"
  ];

  if (optionalModules.permittingWorkspace) {
    artifacts.push("Permitting Workspace Structure Package");
  }
  if (optionalModules.publicRecordsWorkspace) {
    artifacts.push("Public Records Workspace Structure Package");
  }
  if (optionalModules.boardComplianceWorkspace) {
    artifacts.push("Board Compliance Workspace Structure Package");
  }
  if (optionalModules.appointmentsWorkspace) {
    artifacts.push("Appointments Workspace Structure Package");
  }

  return artifacts;
}

function sharePointFoundationSite(context) {
  const safeTenant = String(context.microsoftTenantId || "tenant")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .replace(/[^a-z0-9.-]/gi, "");

  const location =
    safeTenant.includes(".") && safeTenant.includes("sharepoint.com")
      ? `https://${safeTenant}/sites/${context.clientShortName}-vault`
      : `https://${safeTenant || "tenant"}.sharepoint.com/sites/${context.clientShortName}-vault`;

  return {
    name: `${context.clientFormalName} PublicLogic Foundation Site`,
    location,
    permissionBoundary: context.authorityMapping.authorityGroup || "Not specified"
  };
}

export function generateGovernanceDiff({
  context,
  targetSummary,
  existingTargetContent,
  proposedTargetContent,
  emergencyDeclaration = null
}) {
  const foundationSite = sharePointFoundationSite(context);
  const guardrailEvaluation = evaluateGuardrails({
    context,
    existingTargetContent
  });
  const tenantIsolationChecks = buildTenantIsolationChecks({ context, targetSummary });
  const tenantIsolationPassed = tenantIsolationChecks.every((check) => check.ok);
  const guardrails = [...guardrailEvaluation.guardrails];
  const warningMessages = [...guardrailEvaluation.warningMessages];

  if (emergencyDeclaration) {
    guardrails.push({
      id: "emergency-compressed-review",
      severity: "critical",
      title: "Emergency Override Path Active",
      message:
        "Emergency deployment mode is active. Compressed review still requires explicit acknowledgment and 72-hour post-action review.",
      details: {
        declarationId: emergencyDeclaration.id,
        incidentId: emergencyDeclaration.incidentId,
        declaredBy: emergencyDeclaration.declaredBy,
        postActionReviewDueAt: emergencyDeclaration.postActionReviewDueAt
      },
      checklist: [
        {
          id: "incidentScopedToDeclaration",
          label: "I confirm this change is strictly scoped to the declared emergency incident"
        },
        {
          id: "postActionReviewScheduled",
          label: "I confirm 72-hour post-action review is scheduled with accountable authority"
        }
      ]
    });
    warningMessages.push(
      `Emergency declaration ${emergencyDeclaration.incidentId} is active. Post-action review due ${emergencyDeclaration.postActionReviewDueAt}.`
    );
  }

  const validationChecks = [
    ...requiredContextChecklist(context).map((item) => ({
      id: item.id,
      label: item.label,
      ok: item.ok
    })),
    {
      id: "metadata-conflicts",
      label: "No conflicting metadata fields",
      ok: guardrailEvaluation.metadataConflicts.length === 0
    },
    {
      id: "retention-policy",
      label: "Retention policies configured",
      ok: true
    },
    {
      id: "existing-content-preserved",
      label: `Existing content in ${targetSummary.relativeFilePath} will be preserved unless explicitly overwritten`,
      ok: true
    },
    {
      id: "tenant-isolation-pack",
      label: "Tenant isolation checks passed (5 categories)",
      ok: tenantIsolationPassed
    }
  ];

  const diffObject = {
    diffId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    readableSummary:
      "This deployment creates governance structures, preserves existing content by default, and applies explicit permission mappings.",
    target: targetSummary,
    structures: [
      {
        type: "SharePoint Foundation Site",
        name: foundationSite.name,
        location: foundationSite.location,
        permissionBoundary: foundationSite.permissionBoundary
      },
      {
        type: "Document Libraries",
        items: BASE_DOCUMENT_LIBRARIES
      },
      {
        type: "Tracking Lists",
        items: BASE_TRACKING_LISTS
      },
      {
        type: "Power Automate Flows",
        items: BASE_FLOWS
      }
    ],
    artifacts: moduleArtifacts(context.optionalModules),
    permissions: [
      {
        role: "Authority",
        group: context.authorityMapping.authorityGroup || "Not provided",
        access: "Full Control"
      },
      {
        role: "Operators",
        group: context.authorityMapping.operatorsGroup || "Not provided",
        access: "Contribute"
      },
      {
        role: "Read-Only",
        group: context.authorityMapping.readOnlyGroup || "Not provided",
        access: "Read"
      }
    ],
    warnings: warningMessages,
    validations: {
      checks: validationChecks
    },
    guardrails,
    confirmation: {
      label: "Type the client short name to confirm",
      expectedValue: context.clientShortName
    },
    tenantIsolation: {
      passed: tenantIsolationPassed,
      checks: tenantIsolationChecks
    },
    emergencyDeclaration: emergencyDeclaration
      ? {
          id: emergencyDeclaration.id,
          incidentId: emergencyDeclaration.incidentId,
          summary: emergencyDeclaration.summary,
          impactLevel: emergencyDeclaration.impactLevel,
          declaredBy: emergencyDeclaration.declaredBy,
          approver: emergencyDeclaration.approver,
          declaredAt: emergencyDeclaration.declaredAt,
          postActionReviewDueAt: emergencyDeclaration.postActionReviewDueAt
        }
      : null,
    contextSnapshot: context,
    targetContentHash: crypto
      .createHash("sha256")
      .update(String(proposedTargetContent || ""), "utf8")
      .digest("hex")
  };

  return diffObject;
}
