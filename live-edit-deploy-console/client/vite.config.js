import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/hmlp/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: {
      "/health": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/status": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/login": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/logout": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/repos": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/repo-files": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/target": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/content": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/preview-json": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/governance-diff": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/run": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/audit": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/contexts": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/deployment-context": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/emergency": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/veritas-memory": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/veritas": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/health-summary": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/upcoming-deadlines": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/environments": { target: "http://127.0.0.1:3001", changeOrigin: true }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
