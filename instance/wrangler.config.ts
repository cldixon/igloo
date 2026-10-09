import { defineWranglerConfig } from "wrangler/experimental-config";

// cf builds this Worker with the Wrangler bundler. Settings that cf's own
// config does not cover yet live here.
export default defineWranglerConfig({
  assetsDirectory: "./web/build",
  dev: {
    // Without this, dev rewrites every request to http://<custom domain>, so
    // the Worker can't tell it is local. Seeing a loopback origin lets OAuth
    // use an AT Protocol loopback client under `cf dev`.
    port: 8787,
    host: "127.0.0.1:8787",
  },
});
