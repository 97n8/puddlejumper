import crypto from 'crypto';
import express from 'express';
import { signJwt, verifyJwt } from '@publiclogic/core';
import { verifyGoogleIdToken } from '../lib/google.js';
import { verifyGitHubToken } from '../lib/github.js';
import {
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} from '../lib/refreshTokenStore.js';
import { insertAuditEvent, queryAuditEvents } from '../lib/auditStore.js';
import { getOAuthStateStore } from '../lib/oauthStateStore.js';

// ── Structured auth event logger ────────────────────────────────────────────
function authEvent(req: any, event: string, data: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    correlationId: req.correlationId ?? null,
    ip: req.ip,
    ...data,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));

  // Persist to audit DB
  try {
    insertAuditEvent({
      event_type: `auth.${event}`,
      actor_id: (data.sub ?? data.actor ?? null) as string | null,
      target_id: (data.target ?? null) as string | null,
      ip_address: req.ip ?? null,
      user_agent: req.headers?.['user-agent'] ?? null,
      request_id: req.correlationId ?? null,
      metadata: data,
    });
  } catch {
    // best-effort — don't let audit writes break auth flows
  }
}

const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 days in seconds

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api',
  maxAge: REFRESH_TTL_SEC * 1000,
};

const router: express.Router = express.Router();

// ── Login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { provider, providerToken } = req.body as { provider?: string; providerToken?: string };
    if (!provider || !providerToken) return res.status(400).json({ error: 'provider and providerToken required' });

    let userInfo: { sub: string; email?: string; name?: string } | null = null;

    if (provider === 'google') {
      let info: Record<string, any> | null = null;
      try {
        const payload = await verifyGoogleIdToken(providerToken, process.env.PJ_CLIENT_ID);
        info = payload as Record<string, any>;
      } catch {
        return res.status(401).json({ error: 'invalid provider token' });
      }
      userInfo = { sub: info.sub, email: info.email, name: info.name };
    } else if (provider === 'github') {
      try {
        const gi = await verifyGitHubToken(providerToken);
        userInfo = { sub: gi.sub, email: gi.email, name: gi.name };
      } catch (e) {
          authEvent(req, 'login_failed', { provider: 'github', reason: 'invalid_token' });
        return res.status(401).json({ error: 'invalid provider token' });
      }
    } else {
      return res.status(400).json({ error: 'unsupported provider' });
    }

    if (!userInfo) return res.status(401).json({ error: 'could not verify user' });

    const baseClaims = { sub: userInfo.sub, email: userInfo.email, name: userInfo.name, provider } as Record<string, any>;

    // Short-lived access token (1h)
    const accessJwt = await signJwt(baseClaims, { expiresIn: '1h' } as any);

    // Persisted refresh entry — new family chain
    const refreshRow = createRefreshToken(String(userInfo.sub), null, REFRESH_TTL_SEC);
    const refreshJwt = await signJwt(
      { ...baseClaims, jti: refreshRow.id, family: refreshRow.family, token_type: 'refresh' },
      { expiresIn: '7d' } as any,
    );

    res.cookie('pj_refresh', refreshJwt, REFRESH_COOKIE_OPTS);
    authEvent(req, 'login', { sub: userInfo.sub, provider });
    return res.json({ jwt: accessJwt });
  } catch (err) {
    authEvent(req, 'login_error', { error: String(err) });
    return res.status(500).json({ error: 'internal error' });
  }
});

// ── Refresh (rotation with replay detection) ────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.pj_refresh;
    if (!refreshToken) return res.status(401).json({ error: 'no refresh token' });

    const payload = await verifyJwt(refreshToken).catch(() => null) as Record<string, any> | null;
    if (!payload || payload.token_type !== 'refresh' || !payload.jti) {
      return res.status(401).json({ error: 'invalid refresh token' });
    }

    // Attempt rotation — handles replay detection internally
    const result = rotateRefreshToken(payload.jti, REFRESH_TTL_SEC);

    if (!result.ok) {
      if (result.reason === 'token_reuse_detected') {
        // Breach: someone replayed an already-used token → family revoked
        authEvent(req, 'token_reuse_detected', { sub: payload.sub, family: payload.family });
        res.clearCookie('pj_refresh', { path: '/api' });
        return res.status(401).json({ error: 'token_reuse_detected' });
      }
      authEvent(req, 'refresh_failed', { sub: payload.sub, reason: result.reason });
      return res.status(401).json({ error: 'invalid or expired refresh token' });
    }

    const newRow = result.token;
    const newRefreshJwt = await signJwt(
      { sub: payload.sub, email: payload.email, name: payload.name, provider: payload.provider,
        jti: newRow.id, family: newRow.family, token_type: 'refresh' },
      { expiresIn: '7d' } as any,
    );
    res.cookie('pj_refresh', newRefreshJwt, REFRESH_COOKIE_OPTS);

    const newAccess = await signJwt(
      { sub: payload.sub, email: payload.email, name: payload.name, provider: payload.provider },
      { expiresIn: '1h' } as any,
    );
    authEvent(req, 'refresh', { sub: payload.sub });
    return res.json({ jwt: newAccess });
  } catch (err) {
    authEvent(req, 'refresh_error', { error: String(err) });
    return res.status(500).json({ error: 'server error' });
  }
});

// ── Logout — revoke the specific refresh token + clear cookie ─
router.post('/auth/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.pj_refresh;
    if (refreshToken) {
      const payload = await verifyJwt(refreshToken).catch(() => null) as Record<string, any> | null;
      if (payload?.jti) revokeRefreshToken(payload.jti);
      authEvent(req, 'logout', { sub: payload?.sub });
    } else {
      authEvent(req, 'logout', { sub: null });
    }
    res.clearCookie('pj_refresh', { path: '/api' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    authEvent(req, 'logout_error', { error: String(err) });
    return res.status(500).json({ error: 'server error' });
  }
});

// ── Revoke — revoke all tokens for calling user (or admin target) ─
router.post('/auth/revoke', async (req, res) => {
  try {
    // Must have a valid access token (Bearer or cookie)
    const auth = (req as any).auth as Record<string, any> | undefined;
    if (!auth?.sub) return res.status(401).json({ error: 'Unauthorized' });

    const targetUserId: string | undefined = req.body?.user_id;
    if (targetUserId && targetUserId !== auth.sub) {
      // Only admins can revoke other users' tokens
      if (auth.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const count = revokeAllForUser(targetUserId);
      authEvent(req, 'revoke', { actor: auth.sub, target: targetUserId, count });
      return res.json({ revoked: count });
    }

    const count = revokeAllForUser(String(auth.sub));
    authEvent(req, 'revoke', { actor: auth.sub, target: auth.sub, count });
    res.clearCookie('pj_refresh', { path: '/api' });
    return res.json({ revoked: count });
  } catch (err) {
    authEvent(req, 'revoke_error', { error: String(err) });
    return res.status(500).json({ error: 'server error' });
  }
});

// ── Admin audit query ────────────────────────────────────────────
router.get('/admin/audit', (req, res) => {
  try {
    const auth = (req as any).auth as Record<string, any> | undefined;
    if (!auth?.sub) return res.status(401).json({ error: 'Unauthorized' });
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const event_type = typeof req.query.event_type === 'string' ? req.query.event_type : undefined;
    const actor_id = typeof req.query.actor_id === 'string' ? req.query.actor_id : undefined;
    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;

    const events = queryAuditEvents({ event_type, actor_id, after, limit: isNaN(limit) ? 50 : limit });
    return res.json({ events });
  } catch (err) {
    return res.status(500).json({ error: 'server error' });
  }
});

// ── GitHub OAuth redirect flow ─────────────────────────────────

router.get('/auth/github/login', (_req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }

  const state = getOAuthStateStore().create('github');

  const redirectUri =
    process.env.GITHUB_REDIRECT_URI || 'http://localhost:3002/api/auth/github/callback';

  // Also store in a cookie as a secondary check
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 5 * 60 * 1000,
    sameSite: 'lax',
  });

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'user:email');

  return res.redirect(authUrl.toString());
});

router.get('/auth/github/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  // Validate + consume state (single-use, SQLite-backed)
  if (!state || !getOAuthStateStore().consume(state)) {
    return res.status(400).json({ error: 'Invalid or expired state parameter' });
  }
  res.clearCookie('oauth_state');

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    // Exchange code for access token — server-side, secret never exposed
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri:
          process.env.GITHUB_REDIRECT_URI || 'http://localhost:3002/api/auth/github/callback',
      }),
    });

    const tokenBody = (await tokenResponse.json()) as Record<string, any>;
    if (tokenBody.error || !tokenBody.access_token) {
      throw new Error(tokenBody.error_description || tokenBody.error || 'Token exchange failed');
    }

    // Verify token and get user info
    const userInfo = await verifyGitHubToken(tokenBody.access_token);

    // Create session tokens (same logic as POST /api/login)
    const baseClaims = {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      provider: 'github',
    } as Record<string, any>;

    const accessJwt = await signJwt(baseClaims, { expiresIn: '1h' } as any);

    const refreshRow = createRefreshToken(String(userInfo.sub), null, REFRESH_TTL_SEC);
    const refreshJwt = await signJwt(
      { ...baseClaims, jti: refreshRow.id, family: refreshRow.family, token_type: 'refresh' },
      { expiresIn: '7d' } as any,
    );

    res.cookie('pj_refresh', refreshJwt, REFRESH_COOKIE_OPTS);

    authEvent(req, 'login', { sub: userInfo.sub, provider: 'github', method: 'oauth_redirect' });

    // Redirect to frontend with access token in URL hash
    const frontendUrl = process.env.FRONTEND_URL || 'https://pj.publiclogic.org';
    return res.redirect(`${frontendUrl}/#access_token=${accessJwt}`);
  } catch (err: any) {
    authEvent(req, 'login_failed', {
      provider: 'github',
      method: 'oauth_redirect',
      reason: err?.message ?? 'unknown',
    });
    const frontendUrl = process.env.FRONTEND_URL || 'https://pj.publiclogic.org';
    return res.redirect(`${frontendUrl}/#error=authentication_failed`);
  }
});

router.get('/auth/google/login', (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const state = getOAuthStateStore().create('google');

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/api/auth/google/callback';

  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 5 * 60 * 1000,
    sameSite: 'lax',
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);

  return res.redirect(authUrl.toString());
});

router.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!state || !getOAuthStateStore().consume(state)) {
    return res.status(400).json({ error: 'Invalid or expired state parameter' });
  }
  res.clearCookie('google_oauth_state');

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri:
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/api/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    const tokenBody = (await tokenResponse.json()) as Record<string, any>;
    if (tokenBody.error || !tokenBody.access_token) {
      throw new Error(tokenBody.error_description || tokenBody.error || 'Token exchange failed');
    }

    // Get user info from Google
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    if (!userinfoRes.ok) throw new Error(`Google userinfo error ${userinfoRes.status}`);
    const gi = (await userinfoRes.json()) as Record<string, any>;
    if (!gi.id) throw new Error('Missing google id');

    const userInfo = { sub: String(gi.id), email: gi.email, name: gi.name ?? gi.email };

    const baseClaims = {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      provider: 'google',
    } as Record<string, any>;

    const accessJwt = await signJwt(baseClaims, { expiresIn: '1h' } as any);

    const refreshRow = createRefreshToken(String(userInfo.sub), null, REFRESH_TTL_SEC);
    const refreshJwt = await signJwt(
      { ...baseClaims, jti: refreshRow.id, family: refreshRow.family, token_type: 'refresh' },
      { expiresIn: '7d' } as any,
    );

    res.cookie('pj_refresh', refreshJwt, REFRESH_COOKIE_OPTS);
    authEvent(req, 'login', { sub: userInfo.sub, provider: 'google', method: 'oauth_redirect' });

    const frontendUrl = process.env.FRONTEND_URL || 'https://pj.publiclogic.org';
    return res.redirect(`${frontendUrl}/#access_token=${accessJwt}`);
  } catch (err: any) {
    authEvent(req, 'login_failed', {
      provider: 'google',
      method: 'oauth_redirect',
      reason: err?.message ?? 'unknown',
    });
    const frontendUrl = process.env.FRONTEND_URL || 'https://pj.publiclogic.org';
    return res.redirect(`${frontendUrl}/#error=authentication_failed`);
  }
});


router.get('/auth/microsoft/login', (_req, res) => {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Microsoft OAuth not configured' });
  }

  const state = getOAuthStateStore().create('microsoft');

  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3002/api/auth/microsoft/callback';
  const nodeEnv = process.env.NODE_ENV || 'development';

  res.cookie('microsoft_oauth_state', state, {
    httpOnly: true,
    secure: nodeEnv === 'production',
    maxAge: 5 * 60 * 1000,
    sameSite: 'lax',
  });

  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile User.Read');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_mode', 'query');

  return res.redirect(authUrl.toString());
});

router.get('/auth/microsoft/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query as {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  };

  // If Microsoft returned an error (e.g. user denied consent)
  if (error) {
    return res.status(400).json({ error, error_description: error_description || 'Microsoft auth error' });
  }

  if (!state || !getOAuthStateStore().consume(state)) {
    return res.status(400).json({ error: 'Invalid or expired state parameter' });
  }
  res.clearCookie('microsoft_oauth_state');

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3002/api/auth/microsoft/callback';

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid email profile User.Read',
        }),
      },
    );

    const tokenBody = (await tokenResponse.json()) as Record<string, any>;
    if (tokenBody.error || !tokenBody.access_token) {
      throw new Error(tokenBody.error_description || tokenBody.error || 'Token exchange failed');
    }

    // Verify token via MS Graph /me
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenBody.access_token}`, Accept: 'application/json' },
    });
    if (!meRes.ok) {
      const txt = await meRes.text().catch(() => '');
      throw new Error(`Microsoft /me error ${meRes.status} ${txt}`);
    }
    const meJson = (await meRes.json()) as Record<string, any>;
    const msId = meJson.id ? String(meJson.id) : undefined;
    if (!msId) throw new Error('Missing microsoft id');

    const userInfo = {
      sub: msId,
      email: meJson.mail ?? meJson.userPrincipalName ?? undefined,
      name: meJson.displayName ?? meJson.mail ?? undefined,
    };

    const accessJwt = await signJwt(
      { sub: userInfo.sub, email: userInfo.email, name: userInfo.name, provider: 'microsoft', role: 'user' },
      { expiresIn: '15m' },
    );

    const refreshJwt = await signJwt(
      { sub: userInfo.sub, email: userInfo.email, provider: 'microsoft', type: 'refresh' },
      { expiresIn: '7d' } as any,
    );

    res.cookie('pj_refresh', refreshJwt, REFRESH_COOKIE_OPTS);
    authEvent(req, 'login', { sub: userInfo.sub, provider: 'microsoft', method: 'oauth_redirect' });

    const frontendUrl = process.env.FRONTEND_URL || 'https://pj.publiclogic.org';
    return res.redirect(`${frontendUrl}/#access_token=${accessJwt}`);
  } catch (err: any) {
    authEvent(req, 'login_failed', {
      provider: 'microsoft',
      method: 'oauth_redirect',
      reason: err?.message ?? 'unknown',
    });
    const frontendUrl = process.env.FRONTEND_URL || 'https://pj.publiclogic.org';
    return res.redirect(`${frontendUrl}/#error=authentication_failed`);
  }
});

export default router;
