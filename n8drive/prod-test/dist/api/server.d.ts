import { type AuthOptions } from "@publiclogic/core";
import type { CanonicalSourceOptions } from "./canonicalSource.js";
import { PrrStore } from "./prrStore.js";
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
type AccessNotificationWorkerOptions = {
    prrStore: PrrStore;
    webhookUrl: string;
    fetchImpl: typeof fetch;
    batchSize: number;
    maxRetries: number;
};
export declare function processAccessNotificationQueueOnce(options: AccessNotificationWorkerOptions): Promise<void>;
export declare function createApp(nodeEnv?: string, options?: CreateAppOptions): import("express-serve-static-core").Express;
export declare function startServer(): void;
export {};
