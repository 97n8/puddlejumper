import express from "express";
import type { LoginUser } from "../types.js";
type AuthRoutesOptions = {
    builtInLoginEnabled: boolean;
    loginUsers: LoginUser[];
    loginRateLimit: express.RequestHandler;
    nodeEnv: string;
    trustedParentOrigins: string[];
};
export declare function createAuthRoutes(opts: AuthRoutesOptions): express.Router;
export {};
