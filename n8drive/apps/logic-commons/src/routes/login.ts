import express from 'express';
import { signJwt, verifyJwt } from '@publiclogic/core';
import { verifyGoogleIdToken } from '../lib/google.js';
import { verifyGitHubToken } from '../lib/github.js';
import {
  createRefreshEntry,
  verifyRefreshEntry,
  rotateRefreshEntry,
  revokeRefreshEntry,
} from '../lib/refreshTokens.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/refresh',
  maxAge: REFRESH_TTL_MS,
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
        // eslint-disable-next-line no-console
        console.error('github verify failed', e);
        return res.status(401).json({ error: 'invalid provider token' });
      }
    } else {
      return res.status(400).json({ error: 'unsupported provider' });
    }

    if (!userInfo) return res.status(401).json({ error: 'could not verify user' });

    const baseClaims = { sub: userInfo.sub, email: userInfo.email, name: userInfo.name, provider } as Record<string, any>;

    // Short-lived access token (1h)
    const accessJwt = await signJwt(baseClaims, { expiresIn: '1h' } as any);

    // Persisted refresh entry (jti tracked in store)
    const refreshEntry = await createRefreshEntry(String(userInfo.sub), REFRESH_TTL_MS);
    const refreshJwt = await signJwt(
      { ...baseClaims, jti: refreshEntry.jti, token_type: 'refresh' },
      { expiresIn: '7d' } as any,
    );

    res.cookie('pj_refresh', refreshJwt, REFRESH_COOKIE_OPTS);
    return res.json({ jwt: accessJwt });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('login error', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// ── Refresh (rotation) ─────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.pj_refresh;
    if (!refreshToken) return res.status(401).json({ error: 'no refresh token' });

    const payload = await verifyJwt(refreshToken).catch(() => null) as Record<string, any> | null;
    if (!payload || payload.token_type !== 'refresh' || !payload.jti) {
      return res.status(401).json({ error: 'invalid refresh token' });
    }

    // Verify the jti is live in the store and belongs to the same user
    const entry = await verifyRefreshEntry(payload.jti);
    if (!entry || String(entry.userId) !== String(payload.sub)) {
      return res.status(401).json({ error: 'invalid or revoked refresh token' });
    }

    // Rotate: revoke old, create new
    const newEntry = await rotateRefreshEntry(payload.jti, String(payload.sub), REFRESH_TTL_MS);
    const newRefreshJwt = await signJwt(
      { sub: payload.sub, email: payload.email, name: payload.name, provider: payload.provider, jti: newEntry.jti, token_type: 'refresh' },
      { expiresIn: '7d' } as any,
    );

    res.cookie('pj_refresh', newRefreshJwt, REFRESH_COOKIE_OPTS);

    const newAccess = await signJwt(
      { sub: payload.sub, email: payload.email, name: payload.name, provider: payload.provider },
      { expiresIn: '1h' } as any,
    );
    return res.json({ jwt: newAccess });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('refresh error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// ── Revoke ──────────────────────────────────────────────────
router.post('/revoke', async (req, res) => {
  try {
    const refreshToken = req.cookies?.pj_refresh;
    if (!refreshToken) {
      res.clearCookie('pj_refresh', { path: '/api/refresh' });
      return res.status(204).end();
    }
    const payload = await verifyJwt(refreshToken).catch(() => null) as Record<string, any> | null;
    if (payload?.jti) await revokeRefreshEntry(payload.jti);
    res.clearCookie('pj_refresh', { path: '/api/refresh' });
    return res.status(204).end();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('revoke error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

export default router;
