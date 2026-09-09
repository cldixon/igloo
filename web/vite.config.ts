import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

import { searchForWorkspaceRoot } from "vite";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// In dev the SPA runs on Vite (for HMR) and the API runs in `wrangler dev`,
// which holds the real R2 binding. In production both are one Worker.
const WORKER_ORIGIN = process.env.IGLOO_WORKER_ORIGIN ?? "http://localhost:8787";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), resolve(__dirname, "..")],
    },
    proxy: {
      "/api": WORKER_ORIGIN,
      "/health": WORKER_ORIGIN,
      "/mcp": WORKER_ORIGIN,
    },
  },
});
