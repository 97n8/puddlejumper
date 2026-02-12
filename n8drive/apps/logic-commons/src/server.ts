import express from 'express';
import bodyParser from 'body-parser';
import serverless from 'serverless-http';
import { cookieParserMiddleware, validateJwt } from '@publiclogic/core';

const app = express();
app.use(cookieParserMiddleware());
app.use(bodyParser.json());

app.post('/internal/dev-token', async (req, res) => {
  if (process.env.DEV_MODE !== 'true') return res.status(403).json({ error: 'Forbidden' });
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
  const token = await signJwt(payload as any, { expiresIn: '1h' });
  res.json({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
});

app.get('/api/capabilities/manifest', validateJwt(), (req: any, res) => {
  const tenantId = 'default';
  const userId = req.auth?.sub || 'dev';
  res.json({ tenantId, userId, capabilities: { 'missionControl.capabilities.read': true, 'popout.launch': true } });
});

app.get('/api/runtime/context', validateJwt(), (req: any, res) => {
  res.json({ workspace: { id: 'default' }, municipality: { id: 'default' }, operator: req.auth?.sub });
});

export default serverless(app);
