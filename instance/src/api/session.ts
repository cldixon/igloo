import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { WEB_SESSION_COOKIE, WEB_SESSION_TTL_MS, getWebSession, isLoopback } from "@igloo/platform";
import { getOwner } from "../auth/owner.js";
import { bearerToken, verifyApiToken } from "../auth/tokens.js";
import { getDb } from "../db/migrations.js";
import type { Bindings } from "./bindings.js";

export type AdminEnv = {
  Bindings: Bindings;
  Variables: { db: D1Database; ownerDid: string; viaToken: boolean };
};

export function originOf(c: Context): string {
  return new URL(c.req.url).origin;
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, WEB_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !isLoopback(originOf(c)),
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(WEB_SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, WEB_SESSION_COOKIE, { path: "/" });
}

export function sessionToken(c: Context): string | undefined {
  return getCookie(c, WEB_SESSION_COOKIE);
}

/**
 * Admin API guard: the owner's browser session, or an API token.
 *
 * Browser requests that change anything must come from this origin, which
 * with SameSite cookies keeps other sites from making them on the owner's
 * behalf. Token requests carry no cookies, so they need no such check.
 */
export const requireOwner: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const db = await getDb(c.env.DB);
  const owner = await getOwner(db);
  const token = bearerToken(c.req.header("authorization"));
  if (token) {
    if (!owner || !(await verifyApiToken(db, token))) {
      return c.json({ error: "Invalid or expired API token" }, 401);
    }
    c.set("viaToken", true);
  } else {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const origin = c.req.header("origin");
      if (origin !== originOf(c)) return c.json({ error: "Cross-origin request refused" }, 403);
    }
    const did = await getWebSession(db, sessionToken(c));
    if (!did || did !== owner) return c.json({ error: "Sign in as the instance owner" }, 401);
    c.set("viaToken", false);
  }
  c.set("db", db);
  c.set("ownerDid", owner!);
  await next();
};
