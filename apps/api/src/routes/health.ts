import { Router, type IRouter } from "express";

export const healthRouter: IRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    runtime: "puddlejumper-gpr",
    version: "0.1.0-pre",
    timestamp: new Date().toISOString(),
  });
});
