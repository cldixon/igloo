import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createWebSession } from "@igloo/platform";
import { createTestBindings } from "@igloo/platform/testing";

const OWNER = "did:plc:ownerabcdefghijklmnopqrs";
let pdsCalls: { method: string; input: any }[] = [];

mock.module("../../auth/client.js", () => ({
  OAUTH_SCOPE: "atproto",
  getOAuthClient: async () => ({
    restore: async () => ({
      getTokenInfo: async () => ({}),
      fetchHandler: async (path: string, init: RequestInit) => {
        const input = JSON.parse(String(init.body));
        pdsCalls.push({ method: path.replace("/xrpc/", ""), input });
        return Response.json({
          uri: `at://${OWNER}/${input.collection}/${input.rkey}`,
          cid: "bafy1",
        });
      },
    }),
  }),
}));

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
  String(input instanceof Request ? input.url : input).includes("notifyRecord")
    ? Response.json({})
    : realFetch(input, init)) as typeof fetch;

const { app } = await import("../app.js");
const { getDb } = await import("../../db/migrations.js");
const { setSetting } = await import("@igloo/platform");

let env: Record<string, unknown>;
let cookie: string;
let dispose: () => Promise<void>;
let bucket: R2Bucket;
let server: ReturnType<typeof Bun.serve>;
let BASE: string;

beforeEach(async () => {
  const b = await createTestBindings();
  ({ dispose, bucket } = b);
  env = {
    DB: b.db,
    DATA: b.bucket,
    IGLOO_TITLE: "igloo",
    IGLOO_APPVIEW_URL: "https://appview.test",
  };
  const db = await getDb(b.db);
  await setSetting(db, "owner_did", OWNER);
  cookie = `igloo_session=${await createWebSession(db, OWNER)}`;
  pdsCalls = [];
  // A real server: the MCP transport needs real connections.
  server = Bun.serve({ port: 0, fetch: (req) => app.fetch(req, env) });
  BASE = `http://localhost:${server.port}`;
});
afterEach(async () => {
  server.stop(true);
  await dispose();
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

async function call(
  method: string,
  path: string,
  opts: { body?: unknown; auth?: string; cookie?: boolean } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.cookie !== false && !opts.auth) {
    headers.cookie = cookie;
    headers.origin = BASE;
  }
  if (opts.auth) headers.authorization = `Bearer ${opts.auth}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await realFetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function newToken(days = 30) {
  const { body } = await call("POST", "/api/admin/tokens", { body: { name: "ci", days } });
  return body.token as string;
}

async function mcp(method: string, params: object, auth?: string) {
  const res = await realFetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(auth && { authorization: `Bearer ${auth}` }),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data: "));
  return { status: res.status, body: line ? JSON.parse(line.slice(6)) : JSON.parse(text) };
}

describe("API tokens", () => {
  test("are shown once, listed without the secret, and work as bearer auth", async () => {
    const token = await newToken();
    expect(token).toStartWith("igloo_");
    const { body } = await call("GET", "/api/admin/tokens");
    expect(body.tokens).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain(token);
    expect(body.tokens[0].prefix).toBe(token.slice(0, 12));

    const created = await call("POST", "/api/admin/datadirs", {
      body: { slug: "via-token" },
      auth: token,
    });
    expect(created.status).toBe(201);
    const listed = await call("GET", "/api/admin/tokens");
    expect(listed.body.tokens[0].lastUsedAt).not.toBeNull();
  });

  test("can't manage tokens", async () => {
    const token = await newToken();
    expect((await call("GET", "/api/admin/tokens", { auth: token })).status).toBe(403);
    expect(
      (await call("POST", "/api/admin/tokens", { body: { name: "x", days: 1 }, auth: token }))
        .status,
    ).toBe(403);
  });

  test("revoked, expired and made-up tokens are refused", async () => {
    const token = await newToken();
    const { body } = await call("GET", "/api/admin/tokens");
    await call("DELETE", `/api/admin/tokens/${body.tokens[0].id}`);
    expect((await call("GET", "/api/admin/datadirs", { auth: token })).status).toBe(401);

    const expiring = await newToken();
    await (
      await getDb(env.DB as D1Database)
    )
      .prepare("UPDATE api_tokens SET expires_at = '2000-01-01'")
      .run();
    expect((await call("GET", "/api/admin/datadirs", { auth: expiring })).status).toBe(401);
    expect((await call("GET", "/api/admin/datadirs", { auth: "igloo_madeup" })).status).toBe(401);
  });

  test("expiry is bounded", async () => {
    expect((await call("POST", "/api/admin/tokens", { body: { name: "x", days: 0 } })).status).toBe(
      400,
    );
    expect(
      (await call("POST", "/api/admin/tokens", { body: { name: "x", days: 366 } })).status,
    ).toBe(400);
    expect((await call("POST", "/api/admin/tokens", { body: { name: " ", days: 5 } })).status).toBe(
      400,
    );
  });
});

describe("public data dir API", () => {
  test("lists published data dirs only, with download URLs", async () => {
    await bucket.put("wiki/a.csv", "x,y\n1,2\n");
    await call("POST", "/api/admin/datadirs", { body: { slug: "wiki", title: "Wiki" } });
    await call("POST", "/api/admin/datadirs", { body: { slug: "draft" } });
    await call("POST", "/api/admin/datadirs/wiki/files/register", { body: { paths: ["a.csv"] } });
    expect((await call("GET", "/api/datadirs", { cookie: false })).body.dataDirs).toEqual([]);

    await call("POST", "/api/admin/datadirs/wiki/publish");
    const { body } = await call("GET", "/api/datadirs", { cookie: false });
    expect(body.dataDirs.map((d: any) => d.name)).toEqual(["wiki"]);
    expect(body.dataDirs[0]).toMatchObject({
      title: "Wiki",
      recordUri: `at://${OWNER}/dev.cldixon.igloo.dataDir/wiki`,
      feedUrl: `https://appview.test/d/${OWNER}/wiki`,
      files: [{ path: "a.csv", format: "csv", url: `${BASE}/api/download?path=wiki%2Fa.csv` }],
    });
    expect((await call("GET", "/api/datadirs/draft", { cookie: false })).status).toBe(404);
    expect((await call("GET", "/api/datadirs/wiki", { cookie: false })).body.name).toBe("wiki");
  });
});

describe("MCP", () => {
  const toolNames = (body: any) => body.result.tools.map((t: any) => t.name);

  test("anonymous clients get read tools; a token adds write tools", async () => {
    const anon = toolNames((await mcp("tools/list", {})).body);
    expect(anon).toContain("igloo_get_datadir");
    expect(anon).not.toContain("igloo_publish_datadir");
    const token = await newToken();
    const authed = toolNames((await mcp("tools/list", {}, token)).body);
    expect(authed).toContain("igloo_publish_datadir");
    expect(authed).toContain("igloo_set_readme");
  });

  test("a bad token is refused outright", async () => {
    expect((await mcp("tools/list", {}, "igloo_nope")).status).toBe(401);
  });

  test("an agent can create, describe, fill and publish a data dir", async () => {
    const token = await newToken();
    await bucket.put("agent-data/rows.csv", "a\n1\n");
    const tool = (name: string, args: object) =>
      mcp("tools/call", { name, arguments: args }, token);
    await tool("igloo_create_datadir", { name: "agent-data", title: "From an agent" });
    await tool("igloo_add_files", { name: "agent-data", paths: ["rows.csv"] });
    await tool("igloo_set_readme", { name: "agent-data", markdown: "# From an agent\n" });
    await tool("igloo_update_datadir", { name: "agent-data", tags: ["demo"] });
    const published = await tool("igloo_publish_datadir", { name: "agent-data" });
    expect(published.body.result.isError).toBeFalsy();
    expect(pdsCalls.at(-1)!.input.record).toMatchObject({
      name: "agent-data",
      title: "From an agent",
      tags: ["demo"],
      files: [{ path: "rows.csv", format: "csv" }],
    });
    const got = await mcp("tools/call", {
      name: "igloo_get_datadir",
      arguments: { name: "agent-data" },
    });
    expect(JSON.parse(got.body.result.content[0].text).recordUri).toContain("agent-data");
  });
});
