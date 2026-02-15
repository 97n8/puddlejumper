import express from "express";
import type { LiveCapabilities, LiveTile, RuntimeContext } from "../types.js";
import type { ApprovalStore } from "../../engine/approvalStore.js";
import type { ChainStore } from "../../engine/chainStore.js";
import type { PolicyProvider } from "../../engine/policyProvider.js";
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
    /** When provided, chains are created alongside governed approvals. */
    chainStore?: ChainStore;
    /** When provided, authorization, chain template resolution, and audit events route through the policy provider. */
    policyProvider?: PolicyProvider;
};
export declare function createGovernanceRoutes(opts: GovernanceRoutesOptions): express.Router;
export {};
