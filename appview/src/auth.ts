import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  WEB_SESSION_COOKIE,
  WEB_SESSION_TTL_MS,
  createWebSession,
  deleteWebSession,
  getWebSession,
  isLoopback,
  oauthClientFor,
  resolveDid,
} from "@igloo/platform";
import { getDb, getMaintainer } from "./db.js";
import type { AppEnv } from "./index.js";

/**
 * Sign-in for people viewing the feed. Identity only: the AppView asks for
 * the bare `atproto` scope, so it can't read or write anything in the account.
 */
const SCOPE = "atproto";

type Ctx = Context<AppEnv>;

const originOf = (c: Ctx) => new URL(c.req.url).origin;

function oauth(c: Ctx, db: D1Database) {
  return oauthClientFor(db, originOf(c), {
    scope: SCOPE,
    clientName: "igloo",
    signingKeySecret: c.env.OAUTH_SIGNING_KEY,
  });
}

/** The person browsing, when signed in. */
export type Viewer = { did: string; handle: string | null; avatar: string | null } | null;

/** The signed-in viewer for a session cookie's value, if any. */
export async function viewerFor(db: D1Database, sessionToken: string | undefined): Promise<Viewer> {
  const did = await getWebSession(db, sessionToken);
  if (!did) return null;
  const maintainer = await getMaintainer(db, did);
  const known = maintainer?.handle
    ? null
    : await db
        .prepare("SELECT value FROM settings WHERE key = ?")
        .bind(`viewer_handle:${did}`)
        .first<{ value: string }>();
  return {
    did,
    handle: maintainer?.handle ?? known?.value ?? null,
    avatar: maintainer?.avatar ?? null,
  };
}

/** Sign-in failures go back to the sign-in page, which says what happened. */
const loginError = (c: Ctx, error: string, handle = "") =>
  c.redirect(`/login?${new URLSearchParams({ error, ...(handle && { handle }) })}`, 303);

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/oauth/client-metadata.json", async (c) => {
  return c.json((await oauth(c, await getDb(c.env.DB))).clientMetadata);
});

authRoutes.get("/oauth/jwks.json", async (c) => {
  return c.json((await oauth(c, await getDb(c.env.DB))).jwks);
});

authRoutes.post("/login", async (c) => {
  if (c.req.header("origin") !== originOf(c)) return c.text("Cross-origin request refused", 403);
  const db = await getDb(c.env.DB);
  const form = await c.req.formData();
  const handle = String(form.get("handle") ?? "")
    .trim()
    .replace(/^@/, "");
  try {
    const url = await (await oauth(c, db)).authorize(handle);
    return c.redirect(url.toString());
  } catch (error) {
    console.warn("authorize failed", error);
    return loginError(c, "authorize", handle);
  }
});

authRoutes.get("/oauth/callback", async (c) => {
  const db = await getDb(c.env.DB);
  try {
    const client = await oauth(c, db);
    const { session } = await client.callback(new URL(c.req.url).searchParams);
    const did = session.did;
    // Identity is all we needed; don't keep tokens around.
    await client.revoke(did).catch(() => {});
    const identity = await resolveDid(did, { plcDirectory: c.env.PLC_DIRECTORY }).catch(() => null);
    if (identity?.handle) {
      await db
        .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
        .bind(`viewer_handle:${did}`, identity.handle, new Date().toISOString())
        .run();
    }
    setCookie(c, WEB_SESSION_COOKIE, await createWebSession(db, did), {
      httpOnly: true,
      secure: !isLoopback(originOf(c)),
      sameSite: "Lax",
      path: "/",
      maxAge: Math.floor(WEB_SESSION_TTL_MS / 1000),
    });
    return c.redirect("/");
  } catch (error) {
    console.warn("callback failed", error);
    return loginError(c, "callback");
  }
});

authRoutes.post("/logout", async (c) => {
  if (c.req.header("origin") !== originOf(c)) return c.text("Cross-origin request refused", 403);
  await deleteWebSession(await getDb(c.env.DB), getCookie(c, WEB_SESSION_COOKIE));
  deleteCookie(c, WEB_SESSION_COOKIE, { path: "/" });
  return c.redirect("/", 303);
});
