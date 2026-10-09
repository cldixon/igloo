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
  test("the feed lists data dirs with maintainer and instance, escaping record text", async () => {
    const res = await get("/");
    const page = await res.text();
    expect(res.status).toBe(200);
    expect(page).toContain("@alice.test");
    expect(page).toContain("Alice&#39;s igloo");
    expect(page).toContain(`href="/d/${ALICE}/wiki"`);
    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("a data dir page links files straight to the instance and shows hashes", async () => {
    const page = await (await get(`/d/${ALICE}/wiki`)).text();
    expect(page).toContain("https://data.alice.test/api/download?path=wiki%2Fdata.csv");
    expect(page).toContain("a".repeat(64));
    expect(page).toContain(dataDirUri(ALICE, "wiki"));
    expect(page).toContain('data-sha256="' + "b".repeat(64) + '"');
  });

  test("instance and maintainer pages", async () => {
    expect(await (await get(`/i/${ALICE}/data.alice.test`)).text()).toContain("wiki/");
    const maintainer = await (await get(`/m/${ALICE}`)).text();
    expect(maintainer).toContain("Alice");
    expect(maintainer).toContain("Alice&#39;s igloo");
  });

  test("unknown things are 404s", async () => {
    expect((await get(`/d/${ALICE}/nope`)).status).toBe(404);
    expect((await get(`/i/${ALICE}/nope.test`)).status).toBe(404);
    expect((await get("/m/did:plc:bobbbbbbbbbbbbbbbbbbbbbb")).status).toBe(404);
  });
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
