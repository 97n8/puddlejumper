import express from "express";
import { ConnectorStore } from "./connectorStore.js";
type CreateConnectorsRouterOptions = {
    store: ConnectorStore;
    stateHmacKey: string;
    fetchImpl?: typeof fetch;
};
export declare function createConnectorsRouter(options: CreateConnectorsRouterOptions): express.Router;
export {};
