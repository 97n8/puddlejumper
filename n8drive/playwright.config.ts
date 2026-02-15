import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
  },
  webServer: {
    command: 'PORT=3002 JWT_SECRET=test-secret AUTH_ISSUER=test-issuer AUTH_AUDIENCE=test-audience pnpm --filter @publiclogic/logic-commons dev',
    port: 3002,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});