import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@publiclogic/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@publiclogic/logic-commons': path.resolve(__dirname, '../logic-commons/src/index.ts'),
    },
  },
  test: {
    globals: false,
  },
});
