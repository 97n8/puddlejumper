/**
 * Lightweight JWT middleware for Vault (no dependencies on @publiclogic/core)
 */
import type { RequestHandler } from "express";
import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "";
const AUTH_ISSUER = process.env.AUTH_ISSUER || "puddle-jumper";
const AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || "puddle-jumper-api";

interface JwtPayload {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  workspaceId?: string;
  tenantId?: string;
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

function verifySignature(header: string, payload: string, signature: string): boolean {
  const data = `${header}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64url");
  return signature === expectedSignature;
}

function verifyJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature
  if (!verifySignature(headerB64, payloadB64, signatureB64)) {
    throw new Error("Invalid JWT signature");
  }

  // Parse payload
  const payload = JSON.parse(base64UrlDecode(payloadB64)) as JwtPayload;

  // Verify claims
  if (payload.iss !== AUTH_ISSUER) {
    throw new Error(`Invalid issuer: ${payload.iss}`);
  }
  if (payload.aud !== AUTH_AUDIENCE) {
    throw new Error(`Invalid audience: ${payload.aud}`);
  }
  if (payload.exp && payload.exp < Date.now() / 1000) {
    throw new Error("JWT expired");
  }

  return payload;
}

function extractToken(req: any): string | null {
  // Check cookie first
  if (req.cookies?.jwt) return req.cookies.jwt as string;
  
  // Check Authorization header
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  return null;
}

export function createJwtAuthenticationMiddleware(): RequestHandler {
  return async (req: any, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing authentication token" });
    }

    try {
      const payload = verifyJwt(token);
      req.auth = payload;
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid token";
      return res.status(401).json({ error: message });
    }
  };
}
