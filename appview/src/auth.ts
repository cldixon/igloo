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
import { loginPage, type Viewer } from "./views.js";
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

/** The signed-in viewer, if any. */
export async function viewerOf(c: Ctx, db: D1Database): Promise<Viewer> {
  const did = await getWebSession(db, getCookie(c, WEB_SESSION_COOKIE));
  if (!did) return null;
  const handle = (await getMaintainer(db, did))?.handle ?? null;
  const known = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(`viewer_handle:${did}`)
    .first<{ value: string }>();
  return { did, handle: handle ?? known?.value ?? null };
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/oauth/client-metadata.json", async (c) => {
  return c.json((await oauth(c, await getDb(c.env.DB))).clientMetadata);
});

authRoutes.get("/oauth/jwks.json", async (c) => {
  return c.json((await oauth(c, await getDb(c.env.DB))).jwks);
});

authRoutes.get("/login", async (c) => {
  const db = await getDb(c.env.DB);
  return c.html(loginPage(await viewerOf(c, db)));
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
    return c.html(loginPage(null, `Couldn't start sign-in for ${handle || "that handle"}.`), 400);
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
    return c.html(loginPage(null, "Sign-in didn't complete. Try again."), 400);
  }
});

authRoutes.post("/logout", async (c) => {
  if (c.req.header("origin") !== originOf(c)) return c.text("Cross-origin request refused", 403);
  await deleteWebSession(await getDb(c.env.DB), getCookie(c, WEB_SESSION_COOKIE));
  deleteCookie(c, WEB_SESSION_COOKIE, { path: "/" });
  return c.redirect("/");
});
