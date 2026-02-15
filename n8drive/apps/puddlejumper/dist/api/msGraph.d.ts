import express from "express";
import type { AuthContext } from "@publiclogic/core";
import type { MsGraphProfile, RuntimeContext } from "./types.js";
export declare function extractMsGraphToken(req: express.Request): string | null;
export declare function fetchMsGraphProfile(token: string, fetchImpl: typeof fetch): Promise<MsGraphProfile | null>;
export declare function buildMsGraphAuthContext(profile: MsGraphProfile, runtimeContext: RuntimeContext | null, nodeEnv: string): AuthContext | null;
