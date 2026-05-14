import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  createErrorHandler,
  requestLogger,
  withCorrelationId,
} from "../src/api/serverMiddleware.js";

describe("serverMiddleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requestLogger logs structured info context for successful requests", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const app = express();
    app.use(withCorrelationId);
    app.use((req: express.Request & { auth?: Record<string, string> }, _res, next) => {
      req.auth = { sub: "user-1", workspaceId: "ws-1", tenantId: "tenant-1" };
      next();
    });
    app.use(requestLogger);
    app.get("/ok", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app).get("/ok").set("Content-Length", "42");
    expect(res.status).toBe(200);
    expect(infoSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      level: "info",
      scope: "http.request",
      method: "GET",
      path: "/ok",
      statusCode: 200,
      userId: "user-1",
      workspaceId: "ws-1",
      tenantId: "tenant-1",
      contentLength: "42",
    });
    expect(typeof payload.correlationId).toBe("string");
  });

  it("requestLogger classifies 401 responses as unauthorized", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = express();
    app.use(withCorrelationId);
    app.use(requestLogger);
    app.get("/denied", (_req, res) => {
      res.status(401).json({ error: "Unauthorized" });
    });

    const res = await request(app).get("/denied");
    expect(res.status).toBe(401);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(warnSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      level: "warn",
      scope: "http.request",
      path: "/denied",
      statusCode: 401,
      errorType: "unauthorized",
      userId: "anonymous",
      workspaceId: "unknown",
    });
  });

  it("createErrorHandler returns correlationId and detail outside production", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.use(withCorrelationId);
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    app.use(createErrorHandler("test"));

    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
    expect(res.body.detail).toBe("kaboom");
    expect(typeof res.body.correlationId).toBe("string");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("createErrorHandler sanitizes 500 details in production", async () => {
    const app = express();
    app.use(withCorrelationId);
    app.get("/boom", () => {
      throw new Error("secret failure");
    });
    app.use(createErrorHandler("production"));

    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
    expect(res.body.detail).toBeUndefined();
    expect(typeof res.body.correlationId).toBe("string");
  });
});
