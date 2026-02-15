import express from "express";
import { type AuthOptions } from "@publiclogic/core";
import type { CanonicalSourceOptions } from "./canonicalSource.js";
type CreateAppOptions = {
    authOptions?: Partial<AuthOptions>;
    canonicalSourceOptions?: Partial<CanonicalSourceOptions>;
    msGraphFetchImpl?: typeof fetch;
    accessNotificationWorker?: {
        fetchImpl?: typeof fetch;
        intervalMs?: number;
        batchSize?: number;
        maxRetries?: number;
        disable?: boolean;
    };
};
export declare function createApp(nodeEnv?: string, options?: CreateAppOptions): express.Express;
export declare function startServer(): void;
export { processAccessNotificationQueueOnce } from "./accessNotificationWorker.js";
