import { Hono } from "hono";
import { NSID, validateNotifyRecordInput } from "@igloo/lexicon";
import { authRoutes, viewerOf } from "./auth.js";
import {
  dataDirsBy,
  feed,
  getDataDir,
  getDb,
  getInstance,
  getMaintainer,
  getMaintainers,
  instancesBy,
  instancesFor,
  parseSearch,
  searchDataDirs,
} from "./db.js";
import { JetstreamDO } from "./jetstream.js";
import { consumeIndexBatch, type IndexMessage } from "./queue.js";
import { reconcile } from "./reconcile.js";
import {
  dataDirPage,
  feedPage,
  instancePage,
  maintainerPage,
  notFoundPage,
  searchPage,
} from "./views.js";

/** Bindings from cloudflare.config.ts, plus optional secrets (cf workers secrets). */
export type AppEnv = {
  Bindings: Env & {
    /** Enables /admin/* for operating the AppView (reconcile, Jetstream status). */
    ADMIN_TOKEN?: string;
    OAUTH_SIGNING_KEY?: string;
  };
};

const FEED_PAGE_SIZE = 30;

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

app.get("/", async (c) => {
  const db = await getDb(c.env.DB);
  const before = c.req.query("before");
  const items = await feed(db, { limit: FEED_PAGE_SIZE, before });
  const [viewer, maintainers, instances] = await Promise.all([
    viewerOf(c, db),
    getMaintainers(
      db,
      items.map((d) => d.did),
    ),
    instancesFor(
      db,
      items.map((d) => ({ did: d.did, url: d.instanceUrl })),
    ),
  ]);
  const next = items.length === FEED_PAGE_SIZE ? items.at(-1)!.createdAt : null;
  return c.html(feedPage(viewer, items, maintainers, instances, next));
});

app.get("/search", async (c) => {
  const db = await getDb(c.env.DB);
  const q = (c.req.query("q") ?? "").slice(0, 200);
  const items = q ? await searchDataDirs(db, parseSearch(q)) : [];
  const [viewer, maintainers, instances] = await Promise.all([
    viewerOf(c, db),
    getMaintainers(
      db,
      items.map((d) => d.did),
    ),
    instancesFor(
      db,
      items.map((d) => ({ did: d.did, url: d.instanceUrl })),
    ),
  ]);
  return c.html(searchPage(viewer, q, items, maintainers, instances));
});

/** Search for agents and scripts: the same query, as records. */
app.get("/api/search", async (c) => {
  const db = await getDb(c.env.DB);
  const q = (c.req.query("q") ?? "").slice(0, 200);
  const items = q ? await searchDataDirs(db, parseSearch(q)) : [];
  return c.json({
    dataDirs: items.map((d) => ({ uri: d.uri, cid: d.cid, did: d.did, record: d.record })),
  });
});

app.get("/d/:did/:name", async (c) => {
  const db = await getDb(c.env.DB);
  const { did, name } = c.req.param();
  const [viewer, d] = await Promise.all([viewerOf(c, db), getDataDir(db, did, name)]);
  if (!d) return c.html(notFoundPage(viewer, "This data dir"), 404);
  const [maintainer, instances] = await Promise.all([
    getMaintainer(db, did),
    instancesFor(db, [{ did, url: d.instanceUrl }]),
  ]);
  return c.html(
    dataDirPage(viewer, d, maintainer, instances.get(`${did} ${d.instanceUrl}`) ?? null),
  );
});

app.get("/i/:did/:host", async (c) => {
  const db = await getDb(c.env.DB);
  const { did, host } = c.req.param();
  const [viewer, instance] = await Promise.all([viewerOf(c, db), getInstance(db, did, host)]);
  if (!instance) return c.html(notFoundPage(viewer, "This instance"), 404);
  const [maintainer, items] = await Promise.all([
    getMaintainer(db, did),
    dataDirsBy(db, did, instance.url),
  ]);
  return c.html(instancePage(viewer, instance, maintainer, items));
});

app.get("/m/:did", async (c) => {
  const db = await getDb(c.env.DB);
  const did = c.req.param("did");
  const [viewer, maintainer, instances, items] = await Promise.all([
    viewerOf(c, db),
    getMaintainer(db, did),
    instancesBy(db, did),
    dataDirsBy(db, did),
  ]);
  if (!maintainer && instances.length === 0 && items.length === 0) {
    return c.html(notFoundPage(viewer, "This maintainer"), 404);
  }
  return c.html(maintainerPage(viewer, did, maintainer, instances, items));
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
