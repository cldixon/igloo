import { bindings, defineConfig } from "cf/config";
import { loadIglooConfig } from "./config.ts";

// The owner's settings (Worker name, bucket, domain, title) come from
// igloo.config.json, which `bun run setup` writes; see config.ts. Nothing
// specific to one instance belongs in this file.
//
// `bun run dev --local` evaluates this with mode "local", which swaps the real
// bucket for a simulated one and needs no config file.
export default defineConfig(({ mode }) => {
  const local = mode === "local";
  const igloo = loadIglooConfig(import.meta.dirname, {
    allowDefaults: local || process.argv.includes("types"),
  });
  const domain = igloo.domain || null;

  return {
    worker: {
      name: igloo.worker,
      compatibilityDate: "2026-09-08",
      // nodejs_compat is required by the MCP SDK's streamable-HTTP transport,
      // which is shimmed onto node:stream via fetch-to-node.
      compatibilityFlags: ["nodejs_compat"],
      entrypoint: "./src/worker.ts",
      observability: { enabled: true },

      // The zone must be on your own Cloudflare account. Without a domain,
      // workers.dev is the only route the Worker has, so it is turned on.
      ...(domain && { domains: [domain] }),
      workersDev: !domain,

      // Preview versions share production's bindings, and migrations apply
      // themselves on first request, so a preview of a branch with a new
      // migration would change the real database before it merged. Test
      // locally with `bun run dev --local` instead.
      previewUrls: false,

      // The SvelteKit SPA build (directory set in wrangler.config.ts). Navigation
      // requests that do not match a built asset fall through to index.html;
      // runWorkerFirst explicitly claims the API paths so they reach Hono instead.
      assets: {
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/*", "/health", "/mcp", "/mcp/*", "/oauth/*"],
      },

      env: {
        DATA: bindings.r2({ name: igloo.bucket, dev: { remote: !local } }),
        // Instance state: data dirs, file hashes, publish status, settings. The
        // schema migrates itself on first use. Always a local database in dev,
        // so development never writes to the real one. cf deploy creates it.
        DB: bindings.d1({ name: igloo.database ?? igloo.worker }),
        ASSETS: bindings.assets(),
        IGLOO_TITLE: bindings.text(igloo.title ?? "igloo"),
        IGLOO_TAGLINE: bindings.text(igloo.tagline ?? ""),
        IGLOO_THEME: bindings.text(igloo.theme ?? "repo"),
        IGLOO_APPVIEW_URL: bindings.text(igloo.appview ?? ""),
        // Workers AI drafts READMEs and tags for the owner to review. It always
        // runs remotely, so local mode leaves it out.
        ...(!local && { AI: bindings.ai() }),
      },
    },
  };
});
