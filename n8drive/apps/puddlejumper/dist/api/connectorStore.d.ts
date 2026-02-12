export type ConnectorProvider = "microsoft" | "google" | "github";
export type ConnectorTokenRecord = {
    provider: ConnectorProvider;
    tenantId: string;
    userId: string;
    account: string | null;
    scopes: string[];
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
};
type UpsertConnectorTokenInput = {
    provider: ConnectorProvider;
    tenantId: string;
    userId: string;
    account: string | null;
    scopes: string[];
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
};
export declare class ConnectorStore {
    private readonly db;
    constructor(dbPath: string);
    getToken(provider: ConnectorProvider, tenantId: string, userId: string): ConnectorTokenRecord | null;
    upsertToken(input: UpsertConnectorTokenInput): ConnectorTokenRecord;
    clearToken(provider: ConnectorProvider, tenantId: string, userId: string): void;
}
export {};
