import type { Request, RequestHandler } from "express";
export type RateLimitOptions = {
    windowMs: number;
    max: number;
    keyGenerator?: (req: Request) => string;
    dbPath?: string;
};
export declare function createRateLimit(options: RateLimitOptions): RequestHandler;
