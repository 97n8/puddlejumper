import express from 'express';
import { signJwt } from '@publiclogic/core';
const router = express.Router();
router.post('/login', async (req, res) => {
    try {
        const { provider, providerToken } = req.body;
        if (!provider || !providerToken)
            return res.status(400).json({ error: 'provider and providerToken required' });
        let userInfo = null;
        if (provider === 'google') {
            // Quick verification: tokeninfo (fine for prototyping). For production use JWKS verification.
            const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(providerToken)}`);
            if (!tokenInfoRes.ok)
                return res.status(401).json({ error: 'invalid provider token' });
            const info = await tokenInfoRes.json().catch(() => null);
            if (!info)
                return res.status(401).json({ error: 'invalid token response' });
            // Validate audience
            if (info.aud && process.env.PJ_CLIENT_ID && info.aud !== process.env.PJ_CLIENT_ID) {
                return res.status(401).json({ error: 'invalid audience' });
            }
            userInfo = { sub: info.sub, email: info.email, name: info.name };
        }
        else if (provider === 'github') {
            // Placeholder: implement GitHub verification flow as needed
            return res.status(501).json({ error: 'github login not implemented' });
        }
        else {
            return res.status(400).json({ error: 'unsupported provider' });
        }
        if (!userInfo)
            return res.status(401).json({ error: 'could not verify user' });
        const claims = {
            sub: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            provider
        };
        const jwt = await signJwt(claims, { expiresIn: '1h' });
        return res.json({ jwt });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('login error', err);
        return res.status(500).json({ error: 'internal error' });
    }
});
export default router;
