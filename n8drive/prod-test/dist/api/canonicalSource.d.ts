export declare const DEFAULT_CANONICAL_ALLOWED_HOSTS: readonly ["raw.githubusercontent.com", "github.com"];
type Resolver4 = (hostname: string) => Promise<string[]>;
type Resolver6 = (hostname: string) => Promise<string[]>;
export type CanonicalSourceOptions = {
    allowedHosts: string[];
    timeoutMs?: number;
    maxBytes?: number;
    resolve4?: Resolver4;
    resolve6?: Resolver6;
    fetchImpl?: typeof fetch;
};
export declare class CanonicalSourceError extends Error {
    readonly status: number;
    readonly details: Record<string, unknown>;
    constructor(status: number, message: string, details?: Record<string, unknown>);
}
export declare function fetchCanonicalJsonDocument(canonicalUrl: string, options: CanonicalSourceOptions): Promise<string>;
export {};
