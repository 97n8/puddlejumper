import { serialize } from 'cookie';
export function createJwtCookie(jwt, opts) {
    const maxAge = opts?.maxAge ?? 60 * 60; // seconds
    const sameSite = opts?.sameSite ?? 'lax';
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
export function setJwtCookieOnResponse(res, jwt, opts) {
    res.setHeader('Set-Cookie', createJwtCookie(jwt, opts));
}
