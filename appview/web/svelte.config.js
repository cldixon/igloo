import adapter from "@sveltejs/adapter-cloudflare";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // Pages are server-rendered in the AppView Worker (../src/worker.ts wraps
    // the adapter's output with the Hono API, queue, cron and Durable
    // Object), so links shared on Bluesky get real titles and previews.
    adapter: adapter({ config: "svelte.wrangler.jsonc" }),
    alias: { $server: "../src" },
  },
};

export default config;
