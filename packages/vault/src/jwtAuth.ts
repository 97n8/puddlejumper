/**
 * JWT middleware for Vault. Uses `jose` for safe verification (matches @publiclogic/core).
 *
 * Hardened in this revision:
 *   - Fails fast at module load if JWT_SECRET is missing/weak in production.
 *   - Verifies signature, issuer, audience, and expiry with jose (no hand-rolled crypto).
 *   - Validates the payload shape with zod before exposing it on req.auth.
 */
import type { Request, RequestHandler } from "express";
import { jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";

function resolveSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[vault/jwtAuth] JWT_SECRET must be set to a value of at least 16 chars in production"
      );
    }
    // eslint-disable-next-line no-console
    console.warn(
      "[vault/jwtAuth] JWT_SECRET unset or too short — using dev fallback (NOT FOR PRODUCTION)"
    );
    return new TextEncoder().encode(
      raw && raw.length > 0 ? raw : "dev-secret-do-not-use-in-prod"
    );
  }
  return new TextEncoder().encode(raw);
}

const SECRET = resolveSecret();
const AUTH_ISSUER = process.env.AUTH_ISSUER || "puddle-jumper";
const AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || "puddle-jumper-api";

const VaultPayloadSchema = z
  .object({
    sub: z.string().min(1),
    iss: z.string().min(1),
    aud: z.union([z.string(), z.array(z.string())]),
    exp: z.number().int().positive().optional(),
    iat: z.number().int().nonnegative().optional(),
    workspaceId: z.string().optional(),
    tenantId: z.string().optional(),
  })
  .passthrough();

export type VaultJwtPayload = z.infer<typeof VaultPayloadSchema>;

interface AuthedRequest extends Request {
  auth?: VaultJwtPayload;
}

function extractToken(req: AuthedRequest): string | null {
  // cookie-parser middleware augments the Express Request with a cookies map.
  const cookies = (req as Request & { cookies?: Record<string, unknown> }).cookies;
  const jwtCookie = cookies?.jwt;
  if (typeof jwtCookie === "string") return jwtCookie;
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export async function verifyVaultJwt(token: string): Promise<VaultJwtPayload> {
  const { payload } = await jwtVerify(token, SECRET, {
    issuer: AUTH_ISSUER,
    audience: AUTH_AUDIENCE,
  });
  const parsed = VaultPayloadSchema.safeParse(payload as JWTPayload);
  if (!parsed.success) {
    throw new Error("Invalid JWT payload shape");
  }
  return parsed.data;
}

export function createJwtAuthenticationMiddleware(): RequestHandler {
  return async (req, res, next) => {
    const token = extractToken(req as AuthedRequest);
    if (!token) {
      res.status(401).json({ error: "Missing authentication token" });
      return;
    }
    try {
      const payload = await verifyVaultJwt(token);
      (req as AuthedRequest).auth = payload;
      next();
    } catch (err) {
      // Don't leak which step failed — uniform error message.
      const detail = err instanceof Error ? err.message : "Invalid token";
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: "warn",
          scope: "vault.auth",
          msg: "jwt_verify_failed",
          detail,
        })
      );
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}
