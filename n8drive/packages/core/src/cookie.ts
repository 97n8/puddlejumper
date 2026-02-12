import { serialize } from 'cookie';

export function createJwtCookie(jwt: string, opts?: { maxAge?: number; sameSite?: 'Strict' | 'Lax' | 'None' }) {
  const maxAge = opts?.maxAge ?? 60 * 60; // seconds
  const sameSite = opts?.sameSite ?? 'Lax';
  const domain = process.env.COOKIE_DOMAIN ?? '.publiclogic.org';
  return serialize('jwt', jwt, {
    domain,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite,
    maxAge
  });
}

export function setJwtCookieOnResponse(res: any, jwt: string, opts?: { maxAge?: number; sameSite?: 'Strict' | 'Lax' | 'None' }) {
  res.setHeader('Set-Cookie', createJwtCookie(jwt, opts));
}
