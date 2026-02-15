import express from "express";
import type { LiveCapabilities, LiveTile, RuntimeContext } from "../types.js";
import type { ApprovalStore } from "../../engine/approvalStore.js";
import type { CanonicalSourceOptions } from "../canonicalSource.js";
type GovernanceRoutesOptions = {
    runtimeContext: RuntimeContext | null;
    runtimeTiles: LiveTile[];
    runtimeCapabilities: LiveCapabilities | null;
    canonicalSourceOptions?: Partial<CanonicalSourceOptions>;
    msGraphFetchImpl: typeof fetch;
    msGraphTokenExchangeEnabled: boolean;
    nodeEnv: string;
    evaluateRateLimit: express.RequestHandler;
    promptRateLimit: express.RequestHandler;
    pjExecuteRateLimit: express.RequestHandler;
    /** When provided, approved governed decisions are routed through the approval gate. */
    approvalStore?: ApprovalStore;
};
export declare function createGovernanceRoutes(opts: GovernanceRoutesOptions): express.Router;
export {};
