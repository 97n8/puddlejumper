import type { AuthContext } from "@publiclogic/core";
import type { CapabilityManifest, LiveCapabilities, LiveTile, PjActionDefinition, PjActionId, RuntimeContext } from "./types.js";
import type { EvaluateRequestBody, PjExecuteRequestBody } from "./schemas.js";
import type { DecisionResult } from "../engine/governanceEngine.js";
export declare const PJ_ACTION_DEFINITIONS: readonly PjActionDefinition[];
export declare function buildCapabilityManifest(auth: AuthContext, runtimeTiles: LiveTile[], runtimeCapabilities: LiveCapabilities | null): CapabilityManifest;
export declare function isPjActionAllowed(manifest: CapabilityManifest, action: PjActionDefinition): boolean;
export declare function listAllowedPjActions(manifest: CapabilityManifest): Array<{
    id: PjActionId;
    label: string;
    requires: string[];
}>;
export declare function assertTenantScope(auth: AuthContext, payload: EvaluateRequestBody): {
    ok: true;
} | {
    ok: false;
    reason: string;
    details: Record<string, unknown>;
};
export declare function scopedRequestId(userId: string, tenantId: string | null, requestId: string | undefined): string | undefined;
export declare function buildPjEvaluatePayload(auth: AuthContext, runtimeContext: RuntimeContext, request: PjExecuteRequestBody, correlationId: string): EvaluateRequestBody;
export declare function resolveDecisionStatusCode(result: {
    approved: boolean;
    warnings: string[];
}): number;
export declare function buildPjExecuteData(request: PjExecuteRequestBody, evaluatePayload: EvaluateRequestBody, decision: DecisionResult): Record<string, unknown>;
