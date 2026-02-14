import { type CanonicalSourceOptions } from "../api/canonicalSource.js";
export type ConnectorName = "sharepoint" | "powerautomate" | "aad" | "civicplus" | "google" | "github" | "vault";
type TriggerType = "form" | "timer" | "state" | "calendar" | "manual" | "drift" | "webhook";
type IntentType = "open_repository" | "open_365_location" | "run_automation" | "health_check" | "create_environment" | "deploy_policy" | "seal_record" | "route" | "name" | "file" | "notify" | "escalate" | "lock" | "start_clock" | "generate" | "archive" | "gate" | "export";
type ActionMode = "launch" | "governed";
type DelegationRecord = {
    id?: string;
    from?: string;
    until?: string;
    to?: string;
    scope?: string[];
    precedence?: number;
    delegator?: string;
    delegatee?: string;
};
export type InputPayload = {
    workspace: {
        id: string;
        name?: string;
        charter: {
            authority: boolean;
            accountability: boolean;
            boundary: boolean;
            continuity: boolean;
        };
    };
    municipality: {
        id: string;
        name?: string;
        state?: string;
        population?: number;
        statutes?: Record<string, string>;
        policies?: Record<string, Record<string, unknown>>;
        risk_profile?: Record<string, unknown>;
    };
    operator: {
        id: string;
        name?: string;
        role?: string;
        permissions?: string[];
        delegations?: DelegationRecord[];
    };
    action: {
        mode?: ActionMode;
        trigger: {
            type: TriggerType;
            reference?: string;
            evidence?: Record<string, unknown>;
        };
        intent: IntentType;
        targets: string[];
        environment?: "production" | "staging" | "pilot";
        metadata: {
            description?: string;
            archieve?: {
                dept: string;
                type: string;
                date: string;
                seq: number | string;
                v: number | string;
            };
            timer?: {
                due: string;
            };
            state?: {
                from: string;
                to: string;
            };
            calendar?: {
                eventId: string;
            };
            files?: Array<{
                name: string;
                content: string;
                encoding: "utf-8" | "base64";
            }>;
            urgency?: "normal" | "emergency";
            deployMode?: "pr" | "direct";
            connectorHealth?: Record<string, boolean | string>;
            connectorStatus?: Record<string, boolean | string>;
            restricted?: boolean;
            automationId?: string;
            expectedPlanHash?: string;
            canonicalUrl?: string;
            canonicalSha?: string;
        };
        requestId?: string;
    };
    timestamp: string;
};
type PlanStep = {
    stepId: string;
    description: string;
    requiresApproval: boolean;
    connector: ConnectorName | "none";
    status: "pending" | "ready" | "dispatched" | "failed" | "skipped";
    plan: Record<string, unknown>;
};
type EngineOutputBase = {
    status: "approved" | "rejected";
    approved: boolean;
    schemaVersion: number;
    actionPlan: PlanStep[];
    automationPlan: PlanStep[];
    auditRecord: {
        eventId: string;
        workspaceId: string;
        operatorId: string;
        municipalityId: string;
        timestamp: string;
        trigger: string;
        intent: string;
        rationale: string;
        schemaVersion: number;
        evidence: {
            statute: string;
            policyKey: string;
            delegationUsed: string;
            permissionCheck: string;
            mode: ActionMode;
            systemPromptVersion: string;
            delegationEvaluation?: Record<string, unknown>;
            connectorEvidence: Record<string, unknown>;
        };
        planHash: string;
    };
    notices: string[];
    nextSteps: Array<{
        type: string;
        details: Record<string, unknown>;
    }>;
    warnings: string[];
    uiFeedback: {
        lcdStatus: string;
        toast: {
            text: string;
            severity: "info" | "warn" | "error" | "success";
        };
        focus: string | null;
    };
};
type ApprovedDecisionResult = EngineOutputBase & {
    status: "approved";
    approved: true;
};
type RejectedDecisionResult = EngineOutputBase & {
    status: "rejected";
    approved: false;
};
export type DecisionResult = ApprovedDecisionResult | RejectedDecisionResult;
type EngineOptions = {
    auditLogPath?: string;
    idempotencyStorePath?: string;
    idempotencyTtlHours?: number;
    canonicalSourceOptions?: Partial<CanonicalSourceOptions>;
    schemaVersion?: number;
};
export declare function createGovernanceEngine(options?: EngineOptions): {
    evaluate: (input: unknown) => Promise<DecisionResult>;
    systemPromptVersion: string;
    schemaVersion: number;
};
export declare function createDefaultEngine(options?: EngineOptions): {
    evaluate: (input: unknown) => Promise<DecisionResult>;
    systemPromptVersion: string;
    schemaVersion: number;
};
export {};
