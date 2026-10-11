import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createTestD1 } from "@igloo/platform/testing";

// The OAuth client is the one thing that talks to the network; everything
// around it (setup code, ownership, sessions) runs for real against D1.
let callbackDid = "did:plc:owner00000000000000000000";
const authorize = mock(
  async (_handle: string, _opts: { state: string }) => new URL("https://pds.example/authorize"),
);
const revoke = mock(async (_did: string) => {});
let lastState: string | undefined;

mock.module("../../auth/client.js", () => ({
  OAUTH_SCOPE: "atproto",
  getOAuthClient: async () => ({
    clientMetadata: { client_id: "test" },
    jwks: { keys: [] },
    authorize: async (handle: string, opts: { state: string }) => {
      lastState = opts.state;
      return authorize(handle, opts);
    },
    callback: async () => ({ session: { did: callbackDid }, state: lastState }),
    revoke,
  }),
}));

const { app } = await import("../app.js");

const ORIGIN = "https://data.example.com";
const OWNER = "did:plc:owner00000000000000000000";
const STRANGER = "did:plc:stranger000000000000000000";

let env: Record<string, unknown>;
let dispose: () => Promise<void>;

beforeEach(async () => {
  const d1 = await createTestD1();
  dispose = d1.dispose;
  env = { DB: d1.db, IGLOO_TITLE: "igloo", SETUP_CODE: "open-sesame" };
  authorize.mockClear();
  revoke.mockClear();
  lastState = undefined;
});
afterEach(() => dispose());

function request(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") headers.set("origin", ORIGIN);
  if (init.body) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  return app.request(`${ORIGIN}${path}`, { ...init, headers }, env);
}

async function login(body: object) {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
}

/** Run the callback as `did` and return the session cookie it set, if any. */
async function callbackAs(did: string) {
  callbackDid = did;
  const res = await request("/oauth/callback?code=x&state=y");
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  return { res, cookie };
}

describe("claiming a fresh instance", () => {
  test("status reports it unclaimed", async () => {
    const res = await request("/api/auth/status");
    expect(await res.json<unknown>()).toEqual({ claimed: false, owner: null, signedIn: false });
  });

  test("sign-in needs the setup code", async () => {
    expect((await login({ handle: "alice.test", setupCode: "wrong" })).status).toBe(403);
    expect(authorize).not.toHaveBeenCalled();
  });

  test("the first sign-in with the code becomes the owner", async () => {
    const res = await login({ handle: "@alice.test", setupCode: " open-sesame " });
    expect(await res.json<unknown>()).toEqual({ url: "https://pds.example/authorize" });
    expect(authorize.mock.calls[0]?.[0]).toBe("alice.test");

    const { res: cb, cookie } = await callbackAs(OWNER);
    expect(cb.headers.get("location")).toBe("/admin");
    expect(cookie).toStartWith("igloo_session=");

    const status = await request("/api/auth/status", { cookie });
    expect(await status.json<unknown>()).toEqual({ claimed: true, owner: OWNER, signedIn: true });
  });

  test("a callback without a claim can't take an unclaimed instance", async () => {
    lastState = JSON.stringify({});
    const { res, cookie } = await callbackAs(STRANGER);
    expect(res.headers.get("location")).toBe("/admin?error=unclaimed");
    expect(cookie).toBeUndefined();
    expect(revoke).toHaveBeenCalledWith(STRANGER);
  });
});

describe("a claimed instance", () => {
  let ownerCookie: string;

  beforeEach(async () => {
    await login({ handle: "alice.test", setupCode: "open-sesame" });
    ownerCookie = (await callbackAs(OWNER)).cookie!;
  });

  test("the setup code is no longer needed, or useful", async () => {
    await login({ handle: "mallory.test", setupCode: "open-sesame" });
    expect(JSON.parse(lastState!)).toEqual({});
  });

  test("other accounts are turned away and their tokens revoked", async () => {
    await login({ handle: "mallory.test" });
    const { res, cookie } = await callbackAs(STRANGER);
    expect(res.headers.get("location")).toBe("/admin?error=not_owner");
    expect(cookie).toBeUndefined();
    expect(revoke).toHaveBeenCalledWith(STRANGER);
  });

  test("admin API needs the owner's session", async () => {
    expect((await request("/api/admin/datadirs")).status).toBe(401);
    expect((await request("/api/admin/datadirs", { cookie: ownerCookie })).status).toBe(200);
  });

  test("admin writes must come from the instance's own origin", async () => {
    const res = await app.request(
      `${ORIGIN}/api/admin/datadirs`,
      {
        method: "POST",
        headers: {
          cookie: ownerCookie,
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ slug: "x" }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  test("logout ends the session and revokes the OAuth tokens", async () => {
    await request("/api/auth/logout", { method: "POST", cookie: ownerCookie });
    expect(revoke).toHaveBeenCalledWith(OWNER);
    expect((await request("/api/admin/datadirs", { cookie: ownerCookie })).status).toBe(401);
  });
});
