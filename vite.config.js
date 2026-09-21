import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { authoritativeVercelEnv } from "./src/lib/ops-observability.js";

function injectOpsBuildEnv() {
  const raw = String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "")
    .trim()
    .toLowerCase();
  if (!process.env.VITE_RELEASE_SHA && /^[0-9a-f]{7,40}$/.test(raw)) {
    process.env.VITE_RELEASE_SHA = raw.slice(0, 7);
  }
  const vercel = authoritativeVercelEnv(process.env.VERCEL_ENV, process.env.VITE_VERCEL_ENV);
  if (vercel) process.env.VITE_VERCEL_ENV = vercel;
}

injectOpsBuildEnv();

export default defineConfig({
  plugins: [react()],
  // IPv4 explícito: no Windows o default (::1) quebra http://127.0.0.1:5173 e o OAuth Supabase.
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: "./src/test/setup.js",
  },
});
