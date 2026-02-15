import express from "express";
import type { PrrStore } from "../prrStore.js";
type PrrRoutesOptions = {
    prrStore: PrrStore;
};
export declare function createPrrRoutes(opts: PrrRoutesOptions): express.Router;
export {};
