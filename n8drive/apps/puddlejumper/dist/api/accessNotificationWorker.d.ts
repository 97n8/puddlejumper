import type { PrrStore } from "./prrStore.js";
type AccessNotificationWorkerOptions = {
    prrStore: PrrStore;
    webhookUrl: string;
    fetchImpl: typeof fetch;
    batchSize: number;
    maxRetries: number;
};
export declare function processAccessNotificationQueueOnce(options: AccessNotificationWorkerOptions): Promise<void>;
export {};
