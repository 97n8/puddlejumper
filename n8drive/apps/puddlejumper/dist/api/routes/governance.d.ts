import express from "express";
import type { LiveCapabilities, LiveTile, RuntimeContext } from "../types.js";
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
};
export declare function createGovernanceRoutes(opts: GovernanceRoutesOptions): express.Router;
export {};
