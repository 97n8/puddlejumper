import type { RequestHandler } from 'express';
export declare function cookieParserMiddleware(): RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function validateJwt(): RequestHandler;
