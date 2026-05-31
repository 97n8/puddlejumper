import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@pj/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@pj/org-manager': path.resolve(__dirname, '../../packages/org-manager/src/index.ts'),
      '@pj/split-row': path.resolve(__dirname, '../../packages/split-row/src/index.ts'),
      '@pj/casespace-view': path.resolve(__dirname, '../../packages/casespace-view/src/index.ts'),
      '@pj/pipeline': path.resolve(__dirname, '../../packages/pipeline/src/index.ts'),
      '@publiclogic/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@publiclogic/logic-commons': path.resolve(__dirname, '../logic-commons/src/index.ts'),
    },
  },
  test: {
    globals: false,
    // Exclude dist/ so vitest doesn't run each test twice (src + compiled).
    exclude: ['**/.claude/**', '**/node_modules/**', '**/dist/**'],
  },
});
