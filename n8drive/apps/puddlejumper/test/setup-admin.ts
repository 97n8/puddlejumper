import { beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type AppModule = Record<string, any>;

declare global {
  var ADMIN_TOKEN: string | undefined;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadApp(): Promise<any> {
  const tryPaths = [
    '../src/api/server',
    '../src/api/index',
    '../src/server',
    '../src/app',
    '../src/index',
    '../../src/app',
    '../../src/server',
    '../../src/index',
    '../../src/main',
    '../../src',
  ];

  for (const relative of tryPaths) {
    const resolved = path.resolve(__dirname, relative);
    try {
      const mod: AppModule = await import(pathToFileURL(resolved).href);
      if (!mod) continue;
      if (mod.app) return mod.app;
      if (typeof mod.createApp === 'function') return mod.createApp();
      if (mod.default) {
        if (typeof mod.default === 'function') {
          return mod.default();
        }
        return mod.default;
      }
      if (typeof mod === 'function') return mod();
      return mod;
    } catch (err) {
      // ignore and try next path
    }
  }
  throw new Error(`Could not locate puddlejumper app export. Looked in: ${tryPaths.join(', ')}`);
}

function normalizeTokenFromResponse(body: any): string | undefined {
  if (!body) return undefined;
  if (typeof body === 'string') return body;
  if (body.token) return body.token;
  if (body.accessToken) return body.accessToken;
  if (body.data && (body.data.token || body.data.accessToken)) {
    return body.data.token || body.data.accessToken;
  }
  if (body.result && body.result.token) return body.result.token;
  return undefined;
}

async function tryPostPaths(app: any, paths: string[], payload: Record<string, any>) {
  for (const p of paths) {
    try {
      const res = await request(app)
        .post(p)
        .send(payload)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
      if (res && [200, 201, 204].includes(res.status)) {
        return res;
      }
    } catch (err) {
      // ignore and try next path
    }
  }
  return null;
}

let app: any;
let adminToken = '';

beforeAll(async () => {
  app = await loadApp();

  const adminEmail = process.env.PJ_ADMIN_EMAIL ?? process.env.TEST_ADMIN_EMAIL ?? 'admin@local.test';
  const adminPassword = process.env.PJ_ADMIN_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD ?? 'changeme';

  await tryPostPaths(app, [
    '/api/auth/register',
    '/api/register',
    '/register',
    '/api/users',
    '/api/users/create',
  ], {
    email: adminEmail,
    password: adminPassword,
    roles: ['admin'],
  });

  await tryPostPaths(app, [
    '/api/admin/seed-admin',
    '/api/seed-admin',
    '/seed-admin',
  ], {
    email: adminEmail,
    password: adminPassword,
  });

  const loginPaths = ['/api/auth/login', '/api/login', '/auth/login', '/login'];
  const loginRes = await tryPostPaths(app, loginPaths, {
    email: adminEmail,
    password: adminPassword,
  });

  let token = loginRes ? normalizeTokenFromResponse(loginRes.body) : undefined;

  if (!token) token = process.env.ADMIN_TOKEN;
  if (!token) token = process.env.TEST_ADMIN_TOKEN;

  if (!token) {
    const alt = await tryPostPaths(app, ['/api/admin/login-as', '/api/admin/token'], { email: adminEmail });
    if (alt) token = normalizeTokenFromResponse(alt.body);
  }

  if (!token) {
    throw new Error(
      'setup-admin: failed to seed or log in admin. Verify PJ_ADMIN_EMAIL/PJ_ADMIN_PASSWORD in .env and that auth endpoints exist.'
    );
  }

  adminToken = token;
  process.env.TEST_ADMIN_TOKEN = token;
  globalThis.ADMIN_TOKEN = token;
  console.log('setup-admin: obtained admin token length=%d', token.length);
});
