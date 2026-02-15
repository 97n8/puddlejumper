import type { RequestHandler } from 'express';
/** Extract JWT from cookie or Authorization: Bearer header. */
declare function extractToken(req: any): string | null;
export declare function cookieParserMiddleware(): RequestHandler;
export declare function validateJwt(): RequestHandler;
export { extractToken };
