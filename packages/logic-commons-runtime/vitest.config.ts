import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@pj/db': path.resolve(__dirname, '../db/src/index.ts'),
      '@pj/org-manager': path.resolve(__dirname, '../org-manager/src/index.ts'),
      '@publiclogic/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    globals: false,
    pool: 'forks',
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
