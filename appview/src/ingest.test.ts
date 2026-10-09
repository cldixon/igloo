import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NSID } from "@igloo/lexicon";
import { migrate } from "@igloo/platform";
import { createTestD1 } from "@igloo/platform/testing";

mock.module("cloudflare:workers", () => ({ DurableObject: class {} }));

const { ALL_MIGRATIONS, upsertDataDir } = await import("./db.js");
const { uriFromEvent, subscribeUrl } = await import("./jetstream.js");
const { consumeIndexBatch, enqueue } = await import("./queue.js");
const { reconcile } = await import("./reconcile.js");
const { ALICE, BOB, FakeNetwork, dataDirRecord, dataDirUri, instanceRecord, instanceUri } =
  await import("./test/network.js");

let db: D1Database;
let dispose: () => Promise<void>;
let net: InstanceType<typeof FakeNetwork>;
const realFetch = globalThis.fetch;

beforeEach(async () => {
  ({ db, dispose } = await createTestD1());
  await migrate(db, ALL_MIGRATIONS);
  net = new FakeNetwork();
  globalThis.fetch = net.fetch as typeof fetch;
});
afterEach(() => dispose());
afterAll(() => {
  globalThis.fetch = realFetch;
});

/** A queue that records what was sent. */
function fakeQueue() {
  const sent: string[] = [];
  const queue = {
    send: async (body: { uri: string }) => void sent.push(body.uri),
    sendBatch: async (msgs: { body: { uri: string } }[]) =>
      void sent.push(...msgs.map((m) => m.body.uri)),
  } as unknown as Queue;
  return { queue, sent };
}

function env(queue: Queue) {
  return {
    DB: db,
    INDEX_QUEUE: queue,
    RELAY_URL: "https://relay.test",
    PLC_DIRECTORY: "https://plc.directory",
    BSKY_APPVIEW: "https://public.api.bsky.app",
  } as unknown as Env;
}

describe("Jetstream", () => {
  test("igloo commits become record URIs; everything else is dropped", () => {
    const commit = (collection: string, operation = "create") => ({
      did: ALICE,
      time_us: 1,
      kind: "commit" as const,
      commit: { operation: operation as "create", collection, rkey: "wiki" },
    });
    expect(uriFromEvent(commit(NSID.dataDir))).toBe(dataDirUri(ALICE, "wiki"));
    expect(uriFromEvent(commit(NSID.dataDir, "delete"))).toBe(dataDirUri(ALICE, "wiki"));
    expect(uriFromEvent(commit("app.bsky.feed.post"))).toBeNull();
    expect(uriFromEvent({ did: ALICE, time_us: 1, kind: "identity" })).toBeNull();
  });

  test("subscribes to igloo collections and rewinds 5 s from the cursor", () => {
    const url = subscribeUrl("https://jetstream.test", 10_000_000);
    expect(url.pathname).toBe("/subscribe");
    expect(url.searchParams.getAll("wantedCollections")).toEqual([NSID.dataDir, NSID.instance]);
    expect(url.searchParams.get("cursor")).toBe("5000000");
    expect(subscribeUrl("https://jetstream.test", undefined).searchParams.has("cursor")).toBe(
      false,
    );
  });
});

describe("queue consumer", () => {
  function batch(uris: string[]) {
    const acked: string[] = [];
    const retried: string[] = [];
    const messages = uris.map((uri) => ({
      body: { uri },
      ack: () => acked.push(uri),
      retry: () => retried.push(uri),
    }));
    return { batch: { messages } as unknown as MessageBatch<{ uri: string }>, acked, retried };
  }

  test("indexes each URI once, and retries the ones that fail", async () => {
    net.addRepo(ALICE);
    net.addRepo(BOB, "https://down.example.com");
    net.down.add("down.example.com");
    net.put(dataDirUri(ALICE, "wiki"), dataDirRecord("wiki"));
    net.put(dataDirUri(BOB, "x"), dataDirRecord("x"));
    const b = batch([dataDirUri(ALICE, "wiki"), dataDirUri(ALICE, "wiki"), dataDirUri(BOB, "x")]);
    await consumeIndexBatch(b.batch, env(fakeQueue().queue));
    expect(b.acked).toEqual([dataDirUri(ALICE, "wiki"), dataDirUri(ALICE, "wiki")]);
    expect(b.retried).toEqual([dataDirUri(BOB, "x")]);
    const gets = net.calls.filter((u) => u.includes("getRecord") && u.includes("rkey=wiki"));
    expect(gets).toHaveLength(1);
  });

  test("enqueue splits into batches of 100", async () => {
    let batches = 0;
    const queue = { sendBatch: async () => void batches++ } as unknown as Queue;
    await enqueue(
      queue,
      Array.from({ length: 250 }, (_, i) => `at://x/y/${i}`),
    );
    expect(batches).toBe(3);
  });
});

describe("reconcile", () => {
  test("queues every record the network lists, plus indexed ones it no longer does", async () => {
    net.addRepo(ALICE);
    net.put(dataDirUri(ALICE, "wiki"), dataDirRecord("wiki"));
    net.put(instanceUri(ALICE, "data.alice.test"), instanceRecord());
    // In the index, but gone from the network.
    await upsertDataDir(
      db,
      { uri: dataDirUri(ALICE, "old"), did: ALICE, rkey: "old", cid: "c" },
      dataDirRecord("old") as never,
    );

    const { queue, sent } = fakeQueue();
    const report = await reconcile(env(queue), db);
    expect(report).toEqual({ repos: 1, records: 2, stale: 1, failedRepos: [] });
    expect(sent.sort()).toEqual(
      [
        dataDirUri(ALICE, "wiki"),
        instanceUri(ALICE, "data.alice.test"),
        dataDirUri(ALICE, "old"),
      ].sort(),
    );
  });

  test("an unreachable repo is skipped, and its indexed records are left alone", async () => {
    net.addRepo(BOB, "https://down.example.com");
    net.down.add("down.example.com");
    net.put(dataDirUri(BOB, "x"), dataDirRecord("x"));
    await upsertDataDir(
      db,
      { uri: dataDirUri(BOB, "x"), did: BOB, rkey: "x", cid: "c" },
      dataDirRecord("x") as never,
    );

    const { queue, sent } = fakeQueue();
    const report = await reconcile(env(queue), db);
    expect(report.failedRepos).toEqual([BOB]);
    expect(sent).toEqual([]);
  });
});
