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

export default router;
