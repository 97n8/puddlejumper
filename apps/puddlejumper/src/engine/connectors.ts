import type { ConnectorName, InputPayload } from "./governanceEngine.js";

type RetentionRule = { retention: string; route: string };

type BuilderArgs = {
  target: string;
  metadata: InputPayload["action"]["metadata"];
  fileStem: string;
  retention: RetentionRule;
  intent: string;
  requestId?: string;
  stepId: string;
};

function shared(args: BuilderArgs) {
  return {
    target: args.target,
    requestId: args.requestId ?? null,
    intent: args.intent,
    archieveName: args.fileStem,
    retention: args.retention,
    artifacts: [`${args.fileStem}.json`, "archieve.json", "intent_log.json"]
  };
}

export function buildSharePointPlan(args: BuilderArgs) {
  return {
    connector: "sharepoint",
    operation: "prepare_upload_bundle",
    ...shared(args),
    destination: `${args.retention.route}/${args.fileStem}`,
    files: args.metadata?.files ?? []
  };
}

export function buildPowerAutomatePlan(args: BuilderArgs) {
  return {
    connector: "powerautomate",
    operation: "prepare_flow_dispatch",
    ...shared(args),
    flowId: args.target.split(":").slice(1).join(":"),
    monitorRun: true
  };
}

export function buildAadPlan(args: BuilderArgs) {
  return {
    connector: "aad",
    operation: args.intent === "archive" ? "prepare_deprovisioning" : "prepare_provisioning",
    ...shared(args),
    objectId: args.target.split(":").slice(1).join(":"),
    leastPrivilege: true
  };
}

export function buildCivicPlusPlan(args: BuilderArgs) {
  return {
    connector: "civicplus",
    operation: "prepare_form_routing",
    ...shared(args),
    formId: args.target.split(":").slice(1).join(":"),
    deadlineValidation: true
  };
}

export function buildGooglePlan(args: BuilderArgs) {
  return {
    connector: "google",
    operation: "prepare_drive_upload_and_notify",
    ...shared(args),
    drivePath: args.target.split(":").slice(1).join(":"),
    crossDomainCheck: true
  };
}

export function buildGitHubPlan(args: BuilderArgs) {
  const deployMode = args.metadata?.deployMode === "direct" ? "direct" : "pr";
  return {
    connector: "github",
    operation: deployMode === "direct" ? "prepare_direct_commit" : "prepare_branch_and_pr",
    ...shared(args),
    repo: args.target.split(":").slice(1).join(":"),
    branchName: `publiclogic/${args.fileStem.toLowerCase()}`,
    commitMessageTemplate: `[ARCHIEVE ${args.fileStem}] step:${args.stepId} plan:{planHash}`,
    enforceBranchProtection: true,
    files: args.metadata?.files ?? []
  };
}

export function buildVaultPlan(args: BuilderArgs) {
  return {
    connector: "vault",
    operation: "prepare_secret_scope_update",
    ...shared(args),
    keyId: args.target.split(":").slice(1).join(":"),
    workspaceBound: true
  };
}

export function buildConnectorPlan(connector: ConnectorName, args: BuilderArgs): Record<string, unknown> {
  if (connector === "sharepoint") {
    return buildSharePointPlan(args);
  }
  if (connector === "powerautomate") {
    return buildPowerAutomatePlan(args);
  }
  if (connector === "aad") {
    return buildAadPlan(args);
  }
  if (connector === "civicplus") {
    return buildCivicPlusPlan(args);
  }
  if (connector === "google") {
    return buildGooglePlan(args);
  }
  if (connector === "github") {
    return buildGitHubPlan(args);
  }
  if (connector === "vault") {
    return buildVaultPlan(args);
  }

  return {
    connector: "none",
    operation: "noop",
    ...shared(args)
  };
}
