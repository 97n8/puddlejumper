import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@pj/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@pj/org-manager': path.resolve(__dirname, '../../packages/org-manager/src/index.ts'),
      '@pj/split-row': path.resolve(__dirname, '../../packages/split-row/src/index.ts'),
      '@publiclogic/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@publiclogic/logic-commons': path.resolve(__dirname, '../logic-commons/src/index.ts'),
    },
  },
  test: {
    globals: false,
    // Exclude dist/ so vitest doesn't run each test twice (src + compiled).
    exclude: ['**/.claude/**', '**/node_modules/**', '**/dist/**'],
    // Many suites spin up createApp(), which freezes CONTROLLED_DATA_DIR and
    // opens process-wide singletons (e.g. the logic-commons audit store) at
    // module load. Without isolation that frozen state — and the shared
    // on-disk default data dir — leaks across files, so a file passes alone
    // but fails in-suite. Give each test file its own process and run files
    // serially so neither memory nor disk state crosses file boundaries.
    pool: 'forks',
    isolate: true,
    fileParallelism: false,
  },
});
