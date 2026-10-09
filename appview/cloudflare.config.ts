import { bindings, defineConfig, exports, triggers } from "cf/config";

const NAME = "igloo-appview";

export default defineConfig({
  worker: {
    name: NAME,
    compatibilityDate: "2026-09-08",
    entrypoint: "./src/index.ts",
    observability: { enabled: true },

    // Phase 1 prototype hostname. Moves to igloo.social at the reset point.
    domains: ["igloo.cldixon.dev"],
    workersDev: false,
    // Workers that implement a Durable Object don't get preview URLs.
    previewUrls: false,

    exports: {
      // One instance, holding the Jetstream WebSocket.
      JetstreamDO: exports.durableObject({ storage: "sqlite" }),
    },

    triggers: [
      // Records to (re)index: from notifyRecord, Jetstream and reconcile.
      triggers.queue({
        name: "igloo-appview-index",
        maxBatchSize: 20,
        maxRetries: 5,
        retryDelay: 30,
      }),
      // Watchdog: make sure the Jetstream connection is up.
      triggers.scheduled({ schedule: "*/5 * * * *" }),
      // Daily reconcile against the network.
      triggers.scheduled({ schedule: "17 4 * * *" }),
    ],

    env: {
      // Index of igloo records, plus viewer sign-in state. Migrates itself on first use.
      DB: bindings.d1({ name: NAME }),
      INDEX_QUEUE: bindings.queue({ name: "igloo-appview-index" }),
      JETSTREAM: bindings.durableObject({ worker: NAME, exportName: "JetstreamDO" }),
      JETSTREAM_URL: bindings.text("https://jetstream2.us-east.bsky.network"),
      RELAY_URL: bindings.text("https://relay1.us-east.bsky.network"),
      PLC_DIRECTORY: bindings.text("https://plc.directory"),
      BSKY_APPVIEW: bindings.text("https://public.api.bsky.app"),
    },
  },
});
