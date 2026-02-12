import express from 'express';
import { signJwt } from '@publiclogic/core';
import { verifyGoogleIdToken } from '../lib/google.js';
const router = express.Router();
router.post('/login', async (req, res) => {
    try {
        const { provider, providerToken } = req.body;
        if (!provider || !providerToken)
            return res.status(400).json({ error: 'provider and providerToken required' });
        let userInfo = null;
        if (provider === 'google') {
            // Verify using Google's JWKS (recommended for production)
            let info = null;
            try {
                const payload = await verifyGoogleIdToken(providerToken, process.env.PJ_CLIENT_ID);
                info = payload;
            }
            catch (e) {
                return res.status(401).json({ error: 'invalid provider token' });
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
