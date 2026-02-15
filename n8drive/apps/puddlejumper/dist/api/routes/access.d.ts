import express from "express";
import type { PrrStore } from "../prrStore.js";
type AccessRoutesOptions = {
    prrStore: PrrStore;
};
export declare function createAccessRoutes(opts: AccessRoutesOptions): express.Router;
export {};
