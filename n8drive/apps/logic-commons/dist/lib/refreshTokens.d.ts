export type RefreshEntry = {
    jti: string;
    userId: string;
    expiresAt: number;
    revoked: boolean;
    createdAt: number;
};
/** Create a new refresh entry and persist it. Returns the entry (including jti). */
export declare function createRefreshEntry(userId: string, ttlMs: number): Promise<RefreshEntry>;
/** Mark a jti as revoked. Returns true if the entry existed. */
export declare function revokeRefreshEntry(jti: string): Promise<boolean>;
/** Verify a jti is valid (exists, not revoked, not expired). Returns the entry or null. */
export declare function verifyRefreshEntry(jti: string): Promise<RefreshEntry | null>;
/** Revoke old jti and create a new entry for the same user. */
export declare function rotateRefreshEntry(oldJti: string, userId: string, ttlMs: number): Promise<RefreshEntry>;
