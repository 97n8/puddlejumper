import { serialize } from 'cookie';

export function createJwtCookie(jwt: string, opts?: { maxAge?: number; sameSite?: 'strict' | 'lax' | 'none' }) {
  const maxAge = opts?.maxAge ?? 60 * 60; // seconds
  const sameSite = opts?.sameSite ?? 'lax';
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const cookieOpts: Parameters<typeof serialize>[2] = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite,
    maxAge
  };
  if (domain) cookieOpts.domain = domain;
  return serialize('jwt', jwt, cookieOpts);
}

export function setJwtCookieOnResponse(res: any, jwt: string, opts?: { maxAge?: number; sameSite?: 'strict' | 'lax' | 'none' }) {
  const cookie = createJwtCookie(jwt, opts);
  const existing = res.getHeader('Set-Cookie');
  if (existing) {
    const arr = Array.isArray(existing) ? existing : [existing];
    res.setHeader('Set-Cookie', [...arr, cookie]);
  } else {
    res.setHeader('Set-Cookie', cookie);
  }
}
