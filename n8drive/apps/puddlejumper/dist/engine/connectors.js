function shared(args) {
    return {
        target: args.target,
        requestId: args.requestId ?? null,
        intent: args.intent,
        archieveName: args.fileStem,
        retention: args.retention,
        artifacts: [`${args.fileStem}.json`, "archieve.json", "intent_log.json"]
    };
}
export function buildSharePointPlan(args) {
    return {
        connector: "sharepoint",
        operation: "prepare_upload_bundle",
        ...shared(args),
        destination: `${args.retention.route}/${args.fileStem}`,
        files: args.metadata?.files ?? []
    };
}
export function buildPowerAutomatePlan(args) {
    return {
        connector: "powerautomate",
        operation: "prepare_flow_dispatch",
        ...shared(args),
        flowId: args.target.split(":").slice(1).join(":"),
        monitorRun: true
    };
}
export function buildAadPlan(args) {
    return {
        connector: "aad",
        operation: args.intent === "archive" ? "prepare_deprovisioning" : "prepare_provisioning",
        ...shared(args),
        objectId: args.target.split(":").slice(1).join(":"),
        leastPrivilege: true
    };
}
export function buildCivicPlusPlan(args) {
    return {
        connector: "civicplus",
        operation: "prepare_form_routing",
        ...shared(args),
        formId: args.target.split(":").slice(1).join(":"),
        deadlineValidation: true
    };
}
export function buildGooglePlan(args) {
    return {
        connector: "google",
        operation: "prepare_drive_upload_and_notify",
        ...shared(args),
        drivePath: args.target.split(":").slice(1).join(":"),
        crossDomainCheck: true
    };
}
export function buildGitHubPlan(args) {
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
export function buildVaultPlan(args) {
    return {
        connector: "vault",
        operation: "prepare_secret_scope_update",
        ...shared(args),
        keyId: args.target.split(":").slice(1).join(":"),
        workspaceBound: true
    };
}
export function buildConnectorPlan(connector, args) {
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
