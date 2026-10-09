import { bindings, defineConfig } from "cf/config";

// `bun run dev` evaluates this with mode "local" when passed --local, which
// swaps the real bucket for a simulated one.
export default defineConfig(({ mode }) => ({
  worker: {
    name: "igloo",
    compatibilityDate: "2026-09-08",
    // nodejs_compat is required by the MCP SDK's streamable-HTTP transport,
    // which is shimmed onto node:stream via fetch-to-node.
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "./src/worker.ts",
    observability: { enabled: true },

    // Public hostname for this instance. `bun run setup` rewrites this line, or
    // removes it entirely if you do not have a domain — the zone must be on your
    // own Cloudflare account or the deploy will fail.
    domains: ["data.cldixon.dev"],

    // The custom domain above is the only way in, so the Worker is not also
    // served from a second hostname on workers.dev. `bun run setup` flips this
    // back on for instances with no custom domain, which would otherwise deploy
    // a Worker with no route at all.
    workersDev: false,

    // Set explicitly because it otherwise follows `workersDev` — leaving it
    // implicit would silently turn off per-branch preview URLs.
    previewUrls: true,

    // The SvelteKit SPA build (directory set in wrangler.config.ts). Navigation
    // requests that do not match a built asset fall through to index.html;
    // runWorkerFirst explicitly claims the API paths so they reach Hono instead.
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*", "/health", "/mcp", "/mcp/*", "/oauth/*"],
    },

    env: {
      DATA: bindings.r2({ name: "data-repo", dev: { remote: mode !== "local" } }),
      // Instance state: data dirs, file hashes, publish status, settings. The
      // schema migrates itself on first use (src/db/migrate.ts). Always a
      // local database in dev, so development never writes to the real one.
      DB: bindings.d1({ name: "igloo" }),
      ASSETS: bindings.assets(),
      IGLOO_TITLE: bindings.text("igloo"),
      IGLOO_TAGLINE: bindings.text("personal data repository"),
      IGLOO_THEME: bindings.text("repo"),
      IGLOO_APPVIEW_URL: bindings.text("https://igloo.cldixon.dev"),
    },
  },
}));
