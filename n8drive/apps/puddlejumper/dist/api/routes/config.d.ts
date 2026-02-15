import express from "express";
import type { LiveCapabilities, LiveTile, RuntimeContext } from "../types.js";
type ConfigRoutesOptions = {
    runtimeContext: RuntimeContext | null;
    runtimeTiles: LiveTile[];
    runtimeCapabilities: LiveCapabilities | null;
};
export declare function createConfigRoutes(opts: ConfigRoutesOptions): express.Router;
export {};
