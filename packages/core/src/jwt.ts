import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

function resolveJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[core/jwt] JWT_SECRET must be set to a value of at least 16 chars in production'
      );
    }
    // Dev/test only: warn loudly so this never silently leaks into staging.
    // eslint-disable-next-line no-console
    console.warn('[core/jwt] JWT_SECRET unset or too short — using dev fallback (NOT FOR PRODUCTION)');
    return new TextEncoder().encode(raw && raw.length > 0 ? raw : 'dev-secret-do-not-use-in-prod');
  }
  return new TextEncoder().encode(raw);
}

function resolveClaimConfig(): { issuer: string | undefined; audience: string | undefined } {
  const issuer = process.env.AUTH_ISSUER;
  const audience = process.env.AUTH_AUDIENCE;
  if (process.env.NODE_ENV === 'production') {
    if (!issuer) {
      throw new Error('[core/jwt] AUTH_ISSUER must be set in production');
    }
    if (!audience) {
      throw new Error('[core/jwt] AUTH_AUDIENCE must be set in production');
    }
  } else {
    if (!issuer || !audience) {
      // eslint-disable-next-line no-console
      console.warn('[core/jwt] AUTH_ISSUER/AUTH_AUDIENCE unset — issuer/audience claims will not be validated (NOT FOR PRODUCTION)');
    }
  }
  return { issuer, audience };
}

const SECRET = resolveJwtSecret();
const { issuer: ISSUER, audience: AUDIENCE } = resolveClaimConfig();

export async function signJwt(payload: Record<string, any>, opts?: { expiresIn?: number | string }) {
  const builder = new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt();
  if (ISSUER) {
    builder.setIssuer(ISSUER);
  }
  if (AUDIENCE) {
    builder.setAudience(AUDIENCE);
  }
  if (opts?.expiresIn) {
    builder.setExpirationTime(opts.expiresIn as any);
  } else {
    builder.setExpirationTime('1h');
  }
  return await builder.sign(SECRET);
}

export async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, SECRET, {
    ...(ISSUER ? { issuer: ISSUER } : {}),
    ...(AUDIENCE ? { audience: AUDIENCE } : {})
  });
  return payload as JWTPayload;
}
