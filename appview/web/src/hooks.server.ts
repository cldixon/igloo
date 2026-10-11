import type { Handle } from "@sveltejs/kit";
import { WEB_SESSION_COOKIE } from "@igloo/platform";
import { viewerFor } from "$server/auth.js";
import { getDb } from "$server/db.js";

export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform!.env;
  event.locals.db = await getDb(env.DB);
  event.locals.viewer = await viewerFor(event.locals.db, event.cookies.get(WEB_SESSION_COOKIE));
  const response = await resolve(event);
  // Pages show who is signed in, so they must never be cached and shared.
  // (The Cloudflare adapter caches any response that doesn't say so.)
  if (!response.headers.has("cache-control")) {
    response.headers.set("cache-control", "private, no-store");
  }
  return response;
};
