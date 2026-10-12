import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NSID } from "@igloo/lexicon";
import { createTestD1 } from "@igloo/platform/testing";

mock.module("cloudflare:workers", () => ({ DurableObject: class {} }));

const { app } = await import("./index.js");
const { getDb, upsertDataDir, upsertInstance, upsertMaintainer } = await import("./db.js");
const { ALICE, dataDirRecord, dataDirUri, instanceRecord, instanceUri } =
  await import("./test/network.js");

let env: Record<string, unknown>;
let sent: unknown[];
let dispose: () => Promise<void>;

beforeEach(async () => {
  const d1 = await createTestD1();
  dispose = d1.dispose;
  sent = [];
  env = {
    DB: d1.db,
    INDEX_QUEUE: { send: async (body: unknown) => void sent.push(body) },
    ADMIN_TOKEN: "secret",
  };
  const db = await getDb(d1.db);
  await upsertMaintainer(db, {
    did: ALICE,
    handle: "alice.test",
    displayName: "Alice",
    avatar: null,
    description: null,
    pds: "https://pds.example.com",
  });
  await upsertInstance(
    db,
    { uri: instanceUri(ALICE, "data.alice.test"), did: ALICE, rkey: "data.alice.test", cid: "c1" },
    instanceRecord() as never,
  );
  await upsertDataDir(
    db,
    { uri: dataDirUri(ALICE, "wiki"), did: ALICE, rkey: "wiki", cid: "c2" },
    dataDirRecord("wiki", {
      title: "<script>alert(1)</script> Wikipedia",
      readme: { path: "README.md", sha256: "b".repeat(64) },
    }) as never,
  );
});
afterEach(() => dispose());

const get = (path: string, init?: RequestInit) =>
  app.request(`https://igloo.test${path}`, init, env);

describe("notifyRecord", () => {
  const notify = (body: unknown) =>
    get(`/xrpc/${NSID.notifyRecord}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  test("queues a valid igloo record URI", async () => {
    const res = await notify({ uri: dataDirUri(ALICE, "new") });
    expect(res.status).toBe(200);
    expect(sent).toEqual([{ uri: dataDirUri(ALICE, "new") }]);
  });

  test("rejects anything else without queueing", async () => {
    expect((await notify({ uri: `at://${ALICE}/app.bsky.feed.post/1` })).status).toBe(400);
    expect((await notify({})).status).toBe(400);
    expect(sent).toEqual([]);
  });
});

describe("pages", () => {
  const pages = () => import("./pages.js");

  test("the feed lists data dirs with maintainer and instance", async () => {
    const { homePage } = await pages();
    const home = await homePage(await getDb(env.DB as D1Database));
    expect(home.entries).toHaveLength(1);
    const [entry] = home.entries;
    expect(entry!.href).toBe(`/d/${ALICE}/wiki`);
    expect(entry!.actor).toMatchObject({ handle: "alice.test", href: `/m/${ALICE}` });
    expect(entry!.instance).toMatchObject({
      name: "Alice's igloo",
      href: `/i/${ALICE}/data.alice.test`,
    });
    // Record text is passed through as text; Svelte escapes it when rendering.
    expect(entry!.title).toBe("<script>alert(1)</script> Wikipedia");
    expect(home.instances.map((i) => i.dataDirs)).toEqual([1]);
    expect(home.next).toBeNull();
  });

  test("a data dir links files straight to the instance, with hashes and the record", async () => {
    const { dataDirPage } = await pages();
    const page = (await dataDirPage(await getDb(env.DB as D1Database), ALICE, "wiki"))!;
    const d = page.dataDir;
    expect(d.files[0]!.url).toBe("https://data.alice.test/api/download?path=wiki%2Fdata.csv");
    expect(d.files[0]!.sha256).toBe("a".repeat(64));
    expect(d.recordUri).toBe(dataDirUri(ALICE, "wiki"));
    expect(d.readme).toEqual({
      url: "https://data.alice.test/api/download?path=wiki%2FREADME.md",
      sha256: "b".repeat(64),
    });
    expect(d.instance.name).toBe("Alice's igloo");
  });

  test("instance, instances and maintainer pages", async () => {
    const { instancePage, instancesPage, maintainerPage } = await pages();
    const db = await getDb(env.DB as D1Database);
    const instance = (await instancePage(db, ALICE, "data.alice.test"))!;
    expect(instance.dataDirs.map((d) => d.name)).toEqual(["wiki"]);
    expect(instance.operator.handle).toBe("alice.test");
    const directory = await instancesPage(db);
    expect(directory).toMatchObject([{ name: "Alice's igloo", dataDirs: 1, bytes: 2048 }]);
    const maintainer = (await maintainerPage(db, ALICE))!;
    expect(maintainer.person.displayName).toBe("Alice");
    expect(maintainer.instances.map((i) => i.name)).toEqual(["Alice's igloo"]);
  });

  test("unknown things are not found", async () => {
    const { dataDirPage, instancePage, maintainerPage } = await pages();
    const db = await getDb(env.DB as D1Database);
    expect(await dataDirPage(db, ALICE, "nope")).toBeNull();
    expect(await instancePage(db, ALICE, "nope.test")).toBeNull();
    expect(await maintainerPage(db, "did:plc:bobbbbbbbbbbbbbbbbbbbbbb")).toBeNull();
  });

  test("discover lists tags, a random data dir and instances by size", async () => {
    const { discoverPage } = await pages();
    const discover = await discoverPage(await getDb(env.DB as D1Database));
    expect(discover.random?.name).toBe("wiki");
    expect(discover.bySize).toMatchObject([{ name: "Alice's igloo", bytes: 2048 }]);
  });
});

test("pages are left to SvelteKit; the API answers its own paths", async () => {
  expect((await get("/")).status).toBe(404);
  expect((await get("/login", { method: "GET" })).status).toBe(404);
});

test("health", async () => {
  expect(await (await get("/health")).json<unknown>()).toEqual({ status: "ok" });
});

test("operator endpoints need the admin token", async () => {
  expect((await get("/admin/reconcile", { method: "POST" })).status).toBe(401);
  expect(
    (await get("/admin/reconcile", { method: "POST", headers: { authorization: "Bearer wrong" } }))
      .status,
  ).toBe(401);
});
