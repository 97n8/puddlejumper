import type { RequestHandler } from 'express';
/** Extract JWT from cookie or Authorization: Bearer header. */
declare function extractToken(req: any): string | null;
export declare function cookieParserMiddleware(): RequestHandler;
export declare function validateJwt(): RequestHandler;
/**
 * Correlation ID middleware.
 * Reads `x-request-id` from the incoming request or generates a new UUID.
 * Sets `req.correlationId` and echoes the header on the response.
 */
export declare function correlationId(): RequestHandler;
export { extractToken };
