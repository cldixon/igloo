import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NSID, validateDataDir } from "@igloo/lexicon";
import { createWebSession } from "@igloo/platform";
import { createTestBindings } from "@igloo/platform/testing";
import { parquetWriteBuffer } from "hyparquet-writer";

const OWNER = "did:plc:owner00000000000000000000";
const ORIGIN = "https://data.example.com";

/** XRPC calls the instance makes to the owner's PDS. */
let pdsCalls: { method: string; input: Record<string, unknown> }[] = [];
let cidCounter = 0;

mock.module("../../auth/client.js", () => ({
  OAUTH_SCOPE: "atproto",
  getOAuthClient: async () => ({
    restore: async () => ({
      getTokenInfo: async () => ({}),
      fetchHandler: async (path: string, init: RequestInit) => {
        const method = path.replace("/xrpc/", "");
        const input = JSON.parse(String(init.body));
        pdsCalls.push({ method, input });
        if (method === "com.atproto.repo.deleteRecord") return Response.json({});
        return Response.json({
          uri: `at://${OWNER}/${input.collection}/${input.rkey}`,
          cid: `bafycid${++cidCounter}`,
        });
      },
    }),
  }),
}));

// AppView notifications go through global fetch.
const notified: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes(NSID.notifyRecord)) {
    notified.push(JSON.parse(String(init?.body)).uri);
    return Response.json({});
  }
  return realFetch(input, init);
}) as typeof fetch;
afterAll(() => {
  globalThis.fetch = realFetch;
});

const { app } = await import("../app.js");
const { getDb } = await import("../../db/migrations.js");
const { setSetting } = await import("@igloo/platform");

let env: Record<string, unknown>;
let bucket: R2Bucket;
let cookie: string;
let dispose: () => Promise<void>;

beforeEach(async () => {
  const bindings = await createTestBindings();
  ({ bucket, dispose } = bindings);
  env = {
    DB: bindings.db,
    DATA: bucket,
    IGLOO_TITLE: "igloo",
    IGLOO_APPVIEW_URL: "https://appview.example.com",
  };
  const db = await getDb(bindings.db);
  await setSetting(db, "owner_did", OWNER);
  cookie = `igloo_session=${await createWebSession(db, OWNER)}`;
  pdsCalls = [];
  cidCounter = 0;
  notified.length = 0;
});
afterEach(() => dispose());

async function call(
  method: string,
  path: string,
  body?: BodyInit | object,
  headers: Record<string, string> = {},
) {
  const init: RequestInit = { method, headers: { cookie, origin: ORIGIN, ...headers } };
  if (body !== undefined) {
    const isRaw =
      typeof body === "string" || body instanceof Uint8Array || body instanceof ArrayBuffer;
    init.body = isRaw ? (body as BodyInit) : JSON.stringify(body);
    if (!isRaw) (init.headers as Record<string, string>)["content-type"] = "application/json";
    if (isRaw) {
      const length =
        typeof body === "string"
          ? new TextEncoder().encode(body).length
          : (body as Uint8Array).byteLength;
      (init.headers as Record<string, string>)["content-length"] = String(length);
    }
  }
  const res = await app.request(`${ORIGIN}/api/admin${path}`, init, env);
  return { status: res.status, body: (await res.json()) as any };
}

async function sha256(data: string | Uint8Array) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CSV = "a,b\n1,2\n";

async function wikiWithFile() {
  await call("POST", "/datadirs", { slug: "wiki", title: "Wiki", license: "CC-BY-4.0" });
  return call("PUT", "/datadirs/wiki/files?path=data.csv", CSV);
}

describe("uploads", () => {
  test("a file is stored at <slug>/<path> and hashed from R2", async () => {
    const { status, body } = await wikiWithFile();
    expect(status).toBe(200);
    expect(body.dataDir.files).toEqual([
      expect.objectContaining({
        path: "data.csv",
        size: CSV.length,
        sha256: await sha256(CSV),
        contentType: "text/csv",
      }),
    ]);
    expect(await (await bucket.get("wiki/data.csv"))!.text()).toBe(CSV);
  });

  test("paths that escape the data dir are refused", async () => {
    await call("POST", "/datadirs", { slug: "wiki" });
    for (const path of ["../x.csv", "/x.csv", "README.md"]) {
      const { status } = await call(
        "PUT",
        `/datadirs/wiki/files?path=${encodeURIComponent(path)}`,
        CSV,
      );
      expect(status).toBe(400);
    }
  });

  test("multipart uploads are hashed once complete", async () => {
    await call("POST", "/datadirs", { slug: "big" });
    const first = new Uint8Array(5 * 1024 * 1024).fill(7);
    const last = new Uint8Array(1234).fill(9);
    const { body: started } = await call("POST", "/datadirs/big/uploads", { path: "big.bin" });
    const parts = [];
    for (const [i, chunk] of [first, last].entries()) {
      const { body } = await call(
        "PUT",
        `/datadirs/big/uploads/${started.uploadId}?path=big.bin&part=${i + 1}`,
        chunk,
      );
      parts.push(body);
    }
    const { body } = await call("POST", `/datadirs/big/uploads/${started.uploadId}/complete`, {
      path: "big.bin",
      parts,
    });
    const whole = new Uint8Array(first.length + last.length);
    whole.set(first);
    whole.set(last, first.length);
    expect(body.dataDir.files[0]).toMatchObject({
      path: "big.bin",
      size: whole.length,
      sha256: await sha256(whole),
    });
  });

  test("objects already in the folder can be registered", async () => {
    await bucket.put("usbr/flows.parquet", "PAR1");
    await bucket.put("usbr/README.md", "# usbr");
    expect((await call("GET", "/folders")).body.folders).toEqual(["usbr"]);
    await call("POST", "/datadirs", { slug: "usbr" });
    const { body } = await call("GET", "/datadirs/usbr");
    expect(body.unregistered).toEqual([{ path: "flows.parquet", size: 4 }]);
    expect(body.readme).toBe("# usbr");
    const registered = await call("POST", "/datadirs/usbr/files/register", {
      paths: ["flows.parquet"],
    });
    expect(registered.body.dataDir.files[0].sha256).toBe(await sha256("PAR1"));
    expect((await call("GET", "/folders")).body.folders).toEqual([]);
  });
});

describe("publishing", () => {
  test("writes a valid record to the owner's repo and notifies the AppView", async () => {
    await wikiWithFile();
    await call("PUT", "/datadirs/wiki/readme", "# Wiki\n");
    const { status, body } = await call("POST", "/datadirs/wiki/publish");
    expect(status).toBe(200);

    const put = pdsCalls.at(-1)!;
    expect(put.method).toBe("com.atproto.repo.putRecord");
    expect(put.input).toMatchObject({ repo: OWNER, collection: NSID.dataDir, rkey: "wiki" });
    const record = validateDataDir(put.input.record);
    expect(record.ok).toBe(true);
    expect(put.input.record).toMatchObject({
      instance: ORIGIN,
      license: "CC-BY-4.0",
      readme: { path: "README.md", sha256: await sha256("# Wiki\n") },
      files: [{ path: "data.csv", size: CSV.length, sha256: await sha256(CSV) }],
    });

    const uri = `at://${OWNER}/${NSID.dataDir}/wiki`;
    expect(body.dataDir).toMatchObject({
      status: "published",
      recordUri: uri,
      recordCid: "bafycid1",
    });
    expect(notified).toEqual([uri]);
  });

  test("an empty data dir can't be published", async () => {
    await call("POST", "/datadirs", { slug: "wiki" });
    expect((await call("POST", "/datadirs/wiki/publish")).status).toBe(409);
    expect(pdsCalls).toEqual([]);
  });

  test("published files can't change, and R2 is left untouched", async () => {
    await wikiWithFile();
    await call("POST", "/datadirs/wiki/publish");
    expect((await call("PUT", "/datadirs/wiki/files?path=data.csv", "changed")).status).toBe(409);
    expect((await call("DELETE", "/datadirs/wiki/files?path=data.csv")).status).toBe(409);
    expect((await call("PATCH", "/datadirs/wiki", { license: "MIT" })).status).toBe(409);
    expect(await (await bucket.get("wiki/data.csv"))!.text()).toBe(CSV);
  });

  test("metadata and README edits update the record, keeping createdAt", async () => {
    await wikiWithFile();
    await call("POST", "/datadirs/wiki/publish");
    const createdAt = (pdsCalls.at(-1)!.input.record as any).createdAt;
    await call("PATCH", "/datadirs/wiki", { description: "Now with a description" });
    const edited = pdsCalls.at(-1)!.input.record as any;
    expect(edited.description).toBe("Now with a description");
    expect(edited.createdAt).toBe(createdAt);
    const { body } = await call("DELETE", "/datadirs/wiki/readme");
    expect(body.dataDir.recordCid).toBe("bafycid3");
    expect(notified).toHaveLength(3);
  });

  test("unpublishing deletes the record and frees the files", async () => {
    await wikiWithFile();
    await call("POST", "/datadirs/wiki/publish");
    const { body } = await call("POST", "/datadirs/wiki/unpublish");
    expect(pdsCalls.at(-1)).toEqual({
      method: "com.atproto.repo.deleteRecord",
      input: { repo: OWNER, collection: NSID.dataDir, rkey: "wiki" },
    });
    expect(body.dataDir.status).toBe("draft");
    expect(notified.at(-1)).toBe(`at://${OWNER}/${NSID.dataDir}/wiki`);
    expect((await call("DELETE", "/datadirs/wiki/files?path=data.csv")).status).toBe(200);
    expect(await bucket.get("wiki/data.csv")).toBeNull();
  });
});

describe("schema and tags (phase 2)", () => {
  test("an uploaded Parquet file is profiled from its footer, and the record carries it", async () => {
    const parquet = new Uint8Array(
      parquetWriteBuffer({
        columnData: [
          { name: "date", data: ["2026-01-01", "2026-01-02"], type: "STRING" },
          { name: "views", data: [10n, 20n], type: "INT64" },
        ],
      }),
    );
    await call("POST", "/datadirs", { slug: "views" });
    const { body } = await call("PUT", "/datadirs/views/files?path=views.parquet", parquet);
    expect(body.dataDir.files[0]).toMatchObject({
      format: "parquet",
      rows: 2,
      schema: [
        { name: "date", type: "VARCHAR" },
        { name: "views", type: "BIGINT" },
      ],
    });
    await call("POST", "/datadirs/views/publish");
    expect((pdsCalls.at(-1)!.input.record as any).files[0]).toMatchObject({
      format: "parquet",
      rows: 2,
      schema: [
        { name: "date", type: "VARCHAR" },
        { name: "views", type: "BIGINT" },
      ],
    });
  });

  test("a browser-measured CSV profile can be added while published, updating the record", async () => {
    await wikiWithFile();
    await call("POST", "/datadirs/wiki/publish");
    const schema = [
      { name: "a", type: "BIGINT" },
      { name: "b", type: "BIGINT" },
    ];
    const { status, body } = await call("PUT", "/datadirs/wiki/files/profile", {
      path: "data.csv",
      format: "csv",
      rows: 1,
      schema,
    });
    expect(status).toBe(200);
    expect(body.dataDir.files[0]).toMatchObject({ format: "csv", rows: 1, schema });
    expect((pdsCalls.at(-1)!.input.record as any).files[0]).toMatchObject({ rows: 1, schema });
  });

  test("profiles are validated", async () => {
    await wikiWithFile();
    const bad = await call("PUT", "/datadirs/wiki/files/profile", { path: "data.csv", rows: -5 });
    expect(bad.status).toBe(400);
    const missing = await call("PUT", "/datadirs/wiki/files/profile", {
      path: "nope.csv",
      rows: 1,
    });
    expect(missing.status).toBe(404);
  });

  test("tags are cleaned, validated, and published", async () => {
    await wikiWithFile();
    const { body } = await call("PATCH", "/datadirs/wiki", {
      tags: ["Web", " time series ", "web"],
    });
    expect(body.dataDir.tags).toEqual(["web", "time-series"]);
    expect((await call("PATCH", "/datadirs/wiki", { tags: ["no_underscores"] })).status).toBe(400);
    await call("POST", "/datadirs/wiki/publish");
    expect((pdsCalls.at(-1)!.input.record as any).tags).toEqual(["web", "time-series"]);
  });
});

describe("AI drafts", () => {
  test("returns a draft without saving anything", async () => {
    await wikiWithFile();
    env.AI = {
      run: async () => ({
        response:
          '{"description":"A tiny CSV.","tags":["demo"],"readme":"# Wiki\\n\\nTwo columns."}',
      }),
    };
    const { status, body } = await call("POST", "/datadirs/wiki/draft");
    expect(status).toBe(200);
    expect(body.draft).toEqual({
      description: "A tiny CSV.",
      tags: ["demo"],
      readme: "# Wiki\n\nTwo columns.",
    });
    const { body: after } = await call("GET", "/datadirs/wiki");
    expect(after.dataDir.description).toBeNull();
    expect(after.readme).toBeNull();
  });

  test("is unavailable without Workers AI", async () => {
    await wikiWithFile();
    delete env.AI;
    expect((await call("POST", "/datadirs/wiki/draft")).status).toBe(501);
  });
});

describe("instance profile", () => {
  test("publishes the instance record keyed by host", async () => {
    const { status, body } = await call("PUT", "/instance", {
      name: "cldixon's igloo",
      description: "Datasets",
    });
    expect(status).toBe(200);
    expect(pdsCalls[0]).toMatchObject({
      input: {
        collection: NSID.instance,
        rkey: "data.example.com",
        record: {
          $type: NSID.instance,
          url: ORIGIN,
          name: "cldixon's igloo",
          description: "Datasets",
        },
      },
    });
    expect(body.instance.recordUri).toBe(`at://${OWNER}/${NSID.instance}/data.example.com`);
  });

  test("needs a name", async () => {
    expect((await call("PUT", "/instance", { name: " " })).status).toBe(400);
  });
});

test("network status", async () => {
  await wikiWithFile();
  const { body } = await call("GET", "/network");
  expect(body).toMatchObject({
    owner: OWNER,
    pds: { ok: true },
    dataDirs: { total: 1, published: 0 },
    storageBytes: CSV.length,
  });
});
