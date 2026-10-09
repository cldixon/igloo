import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { migrate } from "@igloo/platform";
import { createTestD1 } from "@igloo/platform/testing";
import { ALL_MIGRATIONS, feed, getDataDir, getInstance, getMaintainer } from "./db.js";
import { indexRecord } from "./indexer.js";
import {
  ALICE,
  FakeNetwork,
  dataDirRecord,
  dataDirUri,
  instanceRecord,
  instanceUri,
} from "./test/network.js";

let db: D1Database;
let dispose: () => Promise<void>;
let net: FakeNetwork;

beforeEach(async () => {
  ({ db, dispose } = await createTestD1());
  await migrate(db, ALL_MIGRATIONS);
  net = new FakeNetwork();
  net.addRepo(ALICE, "https://pds.example.com", "alice.test");
});
afterEach(() => dispose());

const index = (uri: string) => indexRecord(db, uri, { fetch: net.fetch });

describe("indexRecord", () => {
  test("indexes a valid dataDir fetched from the author's PDS", async () => {
    const uri = dataDirUri(ALICE, "wiki");
    net.put(uri, dataDirRecord("wiki"), "bafywiki");
    expect(await index(uri)).toBe("indexed");
    const d = await getDataDir(db, ALICE, "wiki");
    expect(d).toMatchObject({ uri, cid: "bafywiki", instanceUrl: "https://data.alice.test" });
    expect(d?.record.title).toBe("Title of wiki");
    expect(net.calls).toContain(
      `https://pds.example.com/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(ALICE)}&collection=dev.cldixon.igloo.dataDir&rkey=wiki`,
    );
    expect(await getMaintainer(db, ALICE)).toMatchObject({
      handle: "alice.test",
      pds: "https://pds.example.com",
    });
  });

  test("an update replaces the indexed record", async () => {
    const uri = dataDirUri(ALICE, "wiki");
    net.put(uri, dataDirRecord("wiki"), "bafy1");
    await index(uri);
    net.put(uri, dataDirRecord("wiki", { title: "New title" }), "bafy2");
    await index(uri);
    expect((await getDataDir(db, ALICE, "wiki"))?.record.title).toBe("New title");
    expect(await feed(db)).toHaveLength(1);
  });

  test("a deleted record leaves the index", async () => {
    const uri = dataDirUri(ALICE, "wiki");
    net.put(uri, dataDirRecord("wiki"));
    await index(uri);
    net.records.delete(uri);
    expect(await index(uri)).toBe("deleted");
    expect(await getDataDir(db, ALICE, "wiki")).toBeNull();
  });

  test("records that fail validation are not indexed, and drop out if they were", async () => {
    const uri = dataDirUri(ALICE, "wiki");
    net.put(uri, dataDirRecord("wiki"));
    await index(uri);
    net.put(uri, dataDirRecord("wiki", { files: [] }));
    expect(await index(uri)).toBe("invalid");
    expect(await getDataDir(db, ALICE, "wiki")).toBeNull();
  });

  test("a dataDir whose name doesn't match its record key is invalid", async () => {
    const uri = dataDirUri(ALICE, "wiki");
    net.put(uri, dataDirRecord("something-else"));
    expect(await index(uri)).toBe("invalid");
  });

  test("an instance record must be keyed by its own host", async () => {
    const good = instanceUri(ALICE, "data.alice.test");
    net.put(good, instanceRecord());
    expect(await index(good)).toBe("indexed");
    expect((await getInstance(db, ALICE, "data.alice.test"))?.record.name).toBe("Alice's igloo");

    const spoofed = instanceUri(ALICE, "data.bob.test");
    net.put(spoofed, instanceRecord("https://data.alice.test"));
    expect(await index(spoofed)).toBe("invalid");
  });

  test("other collections and malformed URIs are ignored without fetching", async () => {
    expect(await index(`at://${ALICE}/app.bsky.feed.post/3k`)).toBe("ignored");
    expect(await index("not a uri")).toBe("ignored");
    expect(net.calls).toEqual([]);
  });

  test("an unreachable PDS throws so the queue retries", async () => {
    const uri = dataDirUri(ALICE, "wiki");
    net.put(uri, dataDirRecord("wiki"));
    net.down.add("pds.example.com");
    await expect(index(uri)).rejects.toThrow();
  });

  test("a missing Bluesky profile falls back to the handle in the DID document", async () => {
    net.profiles.delete(ALICE);
    net.pds.set(ALICE, "https://pds.example.com");
    const uri = dataDirUri(ALICE, "wiki");
    net.put(uri, dataDirRecord("wiki"));
    expect(await index(uri)).toBe("indexed");
    expect((await getMaintainer(db, ALICE))?.handle).toBe("unknown.test");
  });
});
