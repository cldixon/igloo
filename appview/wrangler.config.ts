import { defineWranglerConfig } from "wrangler/experimental-config";

// cf builds this Worker with the Wrangler bundler. Settings that cf's own
// config does not cover yet live here.
export default defineWranglerConfig({
  dev: {
    // Keep requests on their loopback origin in dev (otherwise they're
    // rewritten to http://<custom domain>), so viewer sign-in can use an
    // AT Protocol loopback client. 8788 leaves 8787 for the instance.
    port: 8788,
    host: "127.0.0.1:8788",
  },
});
