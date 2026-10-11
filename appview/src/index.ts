import { Hono } from "hono";
import { NSID, validateNotifyRecordInput } from "@igloo/lexicon";
import { authRoutes } from "./auth.js";
import { getDb, parseSearch, searchDataDirs } from "./db.js";
import { JetstreamDO } from "./jetstream.js";
import { consumeIndexBatch, type IndexMessage } from "./queue.js";
import { reconcile } from "./reconcile.js";

/** Bindings from cloudflare.config.ts, plus optional secrets (cf workers secrets). */
export type AppEnv = {
  Bindings: Env & {
    /** Enables /admin/* for operating the AppView (reconcile, Jetstream status). */
    ADMIN_TOKEN?: string;
    OAUTH_SIGNING_KEY?: string;
  };
};

/**
 * The AppView's API: notifyRecord, sign-in, search as JSON and operator
 * endpoints. Pages are SvelteKit (src/routes); src/worker.ts sends each
 * request to one or the other.
 */
export const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ status: "ok" }));

/**
 * dev.cldixon.igloo.notifyRecord: an instance saying "this record changed".
 * Only a hint: the URI is queued and the record re-fetched from its PDS.
 */
app.post(`/xrpc/${NSID.notifyRecord}`, async (c) => {
  const input = validateNotifyRecordInput(await c.req.json().catch(() => null));
  if (!input.ok) {
    return c.json({ error: "InvalidRequest", message: input.errors.join("; ") }, 400);
  }
  await c.env.INDEX_QUEUE.send({ uri: input.value.uri });
  return c.json({});
});

app.route("/", authRoutes);

/** Search for agents and scripts: the same query, as records. */
app.get("/api/search", async (c) => {
  const db = await getDb(c.env.DB);
  const q = (c.req.query("q") ?? "").slice(0, 200);
  const items = q ? await searchDataDirs(db, parseSearch(q)) : [];
  return c.json({
    dataDirs: items.map((d) => ({ uri: d.uri, cid: d.cid, did: d.did, record: d.record })),
  });
});

// --- Operating the AppView (needs the ADMIN_TOKEN secret) --------------------

app.use("/admin/*", async (c, next) => {
  const token = c.env.ADMIN_TOKEN;
  if (!token || c.req.header("authorization") !== `Bearer ${token}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

/** Run reconcile now: re-queue every igloo record the network knows about. */
app.post("/admin/reconcile", async (c) => {
  return c.json(await reconcile(c.env, await getDb(c.env.DB)));
});

/** Jetstream connection status (connecting it if needed). */
app.get("/admin/jetstream", async (c) => {
  return c.json(await jetstream(c.env).ensure());
});

/** The one Jetstream Durable Object. */
function jetstream(env: Env) {
  const ns = env.JETSTREAM as unknown as DurableObjectNamespace<JetstreamDO>;
  return ns.get(ns.idFromName("jetstream"));
}

const RECONCILE_CRON = "17 4 * * *";

export default {
  fetch: app.fetch,
  queue: (batch, env) => consumeIndexBatch(batch, env),
  async scheduled(controller, env, ctx) {
    if (controller.cron === RECONCILE_CRON) {
      const report = await reconcile(env, await getDb(env.DB));
      console.log("reconcile", JSON.stringify(report));
    }
    // Every run also checks the Jetstream connection.
    ctx.waitUntil(jetstream(env).ensure());
  },
} satisfies ExportedHandler<Env, IndexMessage>;

export { JetstreamDO };
