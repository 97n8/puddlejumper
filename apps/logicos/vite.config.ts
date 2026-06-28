import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname
const base = process.env.LOGICOS_BASE || '/'
const outDir = process.env.LOGICOS_OUT_DIR || 'dist'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  // better-sqlite3 is server/test-only. Mark it external so Rollup never tries
  // to bundle the native module into the browser build.
  optimizeDeps: {
    exclude: ['better-sqlite3'],
  },
  ssr: {
    external: ['better-sqlite3'],
  },
  build: {
    outDir,
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('/node_modules/@uiw/react-codemirror/') || id.includes('/node_modules/@codemirror/')) {
            return 'vendor-codemirror'
          }
          if (id.includes('/src/features/flows/components/FlowsPanel.tsx')) {
            return 'feature-flows'
          }
          if (id.includes('/src/features/logiccode/components/')) {
            return 'feature-code'
          }
          if (id.includes('/src/features/vault/components/VaultEnvironmentWorkspace.tsx')) {
            return 'feature-vault'
          }
          if (id.includes('/src/components/VaultPanel.tsx')) {
            return 'feature-vault-panel'
          }
          if (
            id.includes('/src/features/workspace/components/') &&
            (id.includes('GoogleFileBrowser') || id.includes('MicrosoftFileBrowser') || id.includes('GitHubFileBrowser'))
          ) {
            return 'feature-workspace'
          }
        },
      },
      external: ['better-sqlite3'],
    },
  },
});
