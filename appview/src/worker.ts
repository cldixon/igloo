// @ts-ignore The SvelteKit build writes this (vite build), before cf bundles the Worker.
import kit from "../web/.svelte-kit/cloudflare/_worker.js";
import handlers, { app, JetstreamDO } from "./index.js";
import type { IndexMessage } from "./queue.js";

/**
 * The AppView Worker: the Hono app for the API (notifyRecord, sign-in,
 * search JSON, operator endpoints) and SvelteKit for every page. Queue,
 * cron and the Jetstream Durable Object are the same as in index.ts.
 */
const API = /^\/(health$|xrpc\/|oauth\/|api\/|admin\/)/;
const FORM_POSTS = new Set(["/login", "/logout"]);

const pages = kit as ExportedHandler<Env>;

export default {
  ...handlers,
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const api = API.test(pathname) || (request.method === "POST" && FORM_POSTS.has(pathname));
    return api ? app.fetch(request, env, ctx) : pages.fetch!(request as never, env, ctx);
  },
} satisfies ExportedHandler<Env, IndexMessage>;

export { JetstreamDO };
