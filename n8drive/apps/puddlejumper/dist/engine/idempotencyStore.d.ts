export type ClaimResult<TOutput> = {
    type: "acquired";
} | {
    type: "replay";
    output: TOutput;
} | {
    type: "pending";
    promise: Promise<TOutput>;
} | {
    type: "conflict";
} | {
    type: "schema_mismatch";
    storedSchemaVersion: number;
};
export declare class IdempotencyStore<TOutput> {
    private readonly db;
    private readonly inFlight;
    constructor(dbPath: string);
    private ensureColumn;
    private normalizeSchemaVersion;
    private createDeferred;
    private pruneExpired;
    private readRow;
    private waitForCompletedRow;
    claim(requestId: string, payloadHash: string, nowIso: string, expiresAtIso: string, schemaVersion: number): Promise<ClaimResult<TOutput>>;
    storeResult(requestId: string, output: TOutput, schemaVersion: number, decisionStatus: "approved" | "rejected", auditRecord: unknown, nowIso?: string): void;
    abandon(requestId: string): void;
    close(): void;
}
