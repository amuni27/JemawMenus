import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/apiAuth/, '/api'),
      },
    },
  },
  // AGF-S2-28: only for the E2E smoke suite. The preview server forwards API calls to the suite's own backend, so the
  // browser stays same-origin and the backend's CORS list needs no change. The Origin header is dropped for the same reason.
  preview: mode === "e2e" ? {
    proxy: Object.fromEntries(["/api", "/venue"].map((prefix) => [prefix, {
      target: process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:8081",
      changeOrigin: true,
      configure: (proxy: { on: (event: "proxyReq", handler: (req: { removeHeader: (name: string) => void }) => void) => void }) => {
        proxy.on("proxyReq", (req) => req.removeHeader("origin"));
      },
    }])),
  } : undefined,
}));
