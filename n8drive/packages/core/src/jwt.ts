import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret');

export async function signJwt(payload: Record<string, any>, opts?: { expiresIn?: number | string }) {
  const builder = new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt();
  // set issuer/audience from env when available
  if (process.env.AUTH_ISSUER) {
    builder.setIssuer(process.env.AUTH_ISSUER);
  }
  if (process.env.AUTH_AUDIENCE) {
    builder.setAudience(process.env.AUTH_AUDIENCE);
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
    issuer: process.env.AUTH_ISSUER,
    audience: process.env.AUTH_AUDIENCE
  });
  return payload as JWTPayload;
}
