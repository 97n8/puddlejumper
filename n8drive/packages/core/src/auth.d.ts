import type { RequestHandler } from 'express';
import { signJwt } from './jwt.js';
export type AuthOptions = {
    issuer?: string;
    audience?: string;
    jwtSecret?: string;
};
export type AuthContext = Record<string, any>;
export declare function resolveAuthOptions(opts?: Partial<AuthOptions>): AuthOptions;
export declare function createJwtAuthenticationMiddleware(_opts?: Partial<AuthOptions>): RequestHandler;
export declare function createOptionalJwtAuthenticationMiddleware(_opts?: Partial<AuthOptions>): RequestHandler;
export declare function getAuthContext(req: any): AuthContext | null;
export declare function requireAuthenticated(): RequestHandler;
export declare function requirePermission(permission: string): RequestHandler;
export declare function requireRole(role: string): RequestHandler;
export declare const csrfProtection: RequestHandler;
export { signJwt };
