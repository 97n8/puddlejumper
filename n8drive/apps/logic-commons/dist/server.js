import express from 'express';
import serverless from 'serverless-http';
import { cookieParserMiddleware, csrfProtection, validateJwt } from '@publiclogic/core';
import loginRouter from './routes/login.js';
const app = express();
app.use(cookieParserMiddleware());
app.use(express.json());
// Enforce X-PuddleJumper-Request header on all mutating /api requests
app.use('/api', csrfProtection());
app.post('/internal/dev-token', async (req, res) => {
    if (process.env.DEV_MODE !== 'true')
        return res.status(403).json({ error: 'Forbidden' });
    const payload = {
        sub: req.body.sub || 'dev',
        name: req.body.name || 'Dev',
        role: req.body.role || 'admin',
        permissions: req.body.permissions || [],
        tenants: req.body.tenants || []
    };
    // sign token via local package helper
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { signJwt } = await import('@publiclogic/core');
    const token = await signJwt(payload, { expiresIn: '1h' });
    res.json({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
});
app.get('/api/capabilities/manifest', validateJwt(), (req, res) => {
    const tenantId = 'default';
    const userId = req.auth?.sub || 'dev';
    res.json({ tenantId, userId, capabilities: { 'missionControl.capabilities.read': true, 'popout.launch': true } });
});
app.get('/api/runtime/context', validateJwt(), (req, res) => {
    res.json({ workspace: { id: 'default' }, municipality: { id: 'default' }, operator: req.auth?.sub });
});
// register login route under /api/login
app.use('/api', loginRouter);
// Health endpoint (no auth required)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'logic-commons' });
});
// Export for serverless (Vercel)
export default serverless(app);
// When run directly (dev / test), start an HTTP server
export { app };
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));
if (isDirectRun) {
    const port = parseInt(process.env.PORT || '3002', 10);
    app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`logic-commons listening on :${port}`);
    });
}
