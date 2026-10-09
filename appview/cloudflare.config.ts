import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "igloo-appview",
    compatibilityDate: "2026-09-08",
    entrypoint: "./src/index.ts",
    observability: { enabled: true },

    // Phase 1 prototype hostname. Moves to igloo.social at the reset point.
    domains: ["igloo.cldixon.dev"],
    workersDev: false,
    previewUrls: true,
  },
});
