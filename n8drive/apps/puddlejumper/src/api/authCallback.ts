import type { Request, Response } from 'express';

/**
 * Legacy /auth/callback endpoint.
 *
 * Previously exchanged a providerToken with Logic Commons.  That flow is
 * superseded by the standard OAuth routes (/api/auth/microsoft/login, etc.)
 * and the new token-exchange endpoint (/api/auth/token-exchange).
 *
 * This handler now redirects callers to the standard sign-in page
 * so existing bookmarks and integrations still work.
 */
export default function authCallback(_req: Request, res: Response) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://pj.publiclogic.org';
  res.redirect(`${frontendUrl}/pj/signin`);
}
