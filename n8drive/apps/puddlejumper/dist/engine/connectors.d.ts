import type { ConnectorName, InputPayload } from "./governanceEngine.js";
type RetentionRule = {
    retention: string;
    route: string;
};
type BuilderArgs = {
    target: string;
    metadata: InputPayload["action"]["metadata"];
    fileStem: string;
    retention: RetentionRule;
    intent: string;
    requestId?: string;
    stepId: string;
};
export declare function buildSharePointPlan(args: BuilderArgs): {
    destination: string;
    files: {
        name: string;
        content: string;
        encoding: "utf-8" | "base64";
    }[];
    target: string;
    requestId: string | null;
    intent: string;
    archieveName: string;
    retention: RetentionRule;
    artifacts: string[];
    connector: string;
    operation: string;
};
export declare function buildPowerAutomatePlan(args: BuilderArgs): {
    flowId: string;
    monitorRun: boolean;
    target: string;
    requestId: string | null;
    intent: string;
    archieveName: string;
    retention: RetentionRule;
    artifacts: string[];
    connector: string;
    operation: string;
};
export declare function buildAadPlan(args: BuilderArgs): {
    objectId: string;
    leastPrivilege: boolean;
    target: string;
    requestId: string | null;
    intent: string;
    archieveName: string;
    retention: RetentionRule;
    artifacts: string[];
    connector: string;
    operation: string;
};
export declare function buildCivicPlusPlan(args: BuilderArgs): {
    formId: string;
    deadlineValidation: boolean;
    target: string;
    requestId: string | null;
    intent: string;
    archieveName: string;
    retention: RetentionRule;
    artifacts: string[];
    connector: string;
    operation: string;
};
export declare function buildGooglePlan(args: BuilderArgs): {
    drivePath: string;
    crossDomainCheck: boolean;
    target: string;
    requestId: string | null;
    intent: string;
    archieveName: string;
    retention: RetentionRule;
    artifacts: string[];
    connector: string;
    operation: string;
};
export declare function buildGitHubPlan(args: BuilderArgs): {
    repo: string;
    branchName: string;
    commitMessageTemplate: string;
    enforceBranchProtection: boolean;
    files: {
        name: string;
        content: string;
        encoding: "utf-8" | "base64";
    }[];
    target: string;
    requestId: string | null;
    intent: string;
    archieveName: string;
    retention: RetentionRule;
    artifacts: string[];
    connector: string;
    operation: string;
};
export declare function buildVaultPlan(args: BuilderArgs): {
    keyId: string;
    workspaceBound: boolean;
    target: string;
    requestId: string | null;
    intent: string;
    archieveName: string;
    retention: RetentionRule;
    artifacts: string[];
    connector: string;
    operation: string;
};
export declare function buildConnectorPlan(connector: ConnectorName, args: BuilderArgs): Record<string, unknown>;
export {};
