import express, { type Router } from 'express';
import { signJwt } from '@publiclogic/core';
import { verifyGoogleIdToken } from '../lib/google.js';

const router: Router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { provider, providerToken } = req.body as { provider?: string; providerToken?: string };
    if (!provider || !providerToken) return res.status(400).json({ error: 'provider and providerToken required' });

    let userInfo: { sub: string; email?: string; name?: string } | null = null;

    if (provider === 'google') {
      // Verify using Google's JWKS (recommended for production)
      let info: Record<string, any> | null = null;
      try {
        const payload = await verifyGoogleIdToken(providerToken, process.env.PJ_CLIENT_ID);
        info = payload as Record<string, any>;
      } catch (e) {
        return res.status(401).json({ error: 'invalid provider token' });
      }
      userInfo = { sub: info.sub, email: info.email, name: info.name };
    } else if (provider === 'github') {
      // Placeholder: implement GitHub verification flow as needed
      return res.status(501).json({ error: 'github login not implemented' });
    } else {
      return res.status(400).json({ error: 'unsupported provider' });
    }

    if (!userInfo) return res.status(401).json({ error: 'could not verify user' });

    const claims = {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      provider
    } as Record<string, any>;

    const jwt = await signJwt(claims, { expiresIn: '1h' } as any);

    return res.json({ jwt });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('login error', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

export default router;
