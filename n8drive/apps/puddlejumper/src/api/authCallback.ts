import type { Request, Response } from 'express';

/**
 * Legacy /auth/callback endpoint.
 *
 * Previously exchanged a providerToken with Logic Commons.  That flow is
 * superseded by the standard OAuth routes (/api/auth/microsoft/login, etc.)
 * and the new token-exchange endpoint (/api/auth/token-exchange).
 *
 * This handler now redirects callers to the standard Microsoft OAuth login
 * so existing bookmarks and integrations still work.
 */
export default function authCallback(_req: Request, res: Response) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://pj.publiclogic.org';
  res.redirect(`${frontendUrl}/login`);
export default async function authCallback(req: Request, res: Response) {
  try {
    const providerToken = (req.query.providerToken as string) || (req.body && (req.body.providerToken as string));
    if (!providerToken) {
      return res.status(400).send('Missing provider token');
    }

    const commonsUrl = (process.env.LOGIC_COMMONS_URL || 'http://localhost:3001').replace(/\/$/, '');
    const tokenEndpoint = process.env.DEV_MODE === 'true' ? '/internal/dev-token' : '/api/login';
    const resp = await (globalThis.fetch ?? fetch)(`${commonsUrl}${tokenEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerToken })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).send(`Logic Commons login failed: ${txt}`);
    }

    const body = await resp.json().catch(() => ({}));
    const token = body.access_token || body.jwt || body.token;
    if (!token) {
      return res.status(502).send('Logic Commons returned no token');
    }

    setJwtCookieOnResponse(res, token, { maxAge: Number(process.env.JWT_MAX_AGE_SECONDS ?? 3600), sameSite: 'lax' });
    res.redirect('/pj/admin');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('auth callback error', err);
    res.status(500).send('Auth callback error');
  }
}
