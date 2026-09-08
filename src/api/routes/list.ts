import { Hono } from "hono";
import { listObjects, getReadme } from "../storage.js";
import type { Bindings } from "../bindings.js";
import type { DirectoryListing } from "../../shared/types.js";

export const listRoute = new Hono<{ Bindings: Bindings }>();

listRoute.get("/list", async (c) => {
  let path = c.req.query("path") ?? "";

  // Normalize: ensure trailing slash for non-empty paths
  if (path && !path.endsWith("/")) {
    path += "/";
  }

  const [entries, readme] = await Promise.all([
    listObjects(c.env.DATA, path),
    getReadme(c.env.DATA, path),
  ]);

  const listing: DirectoryListing = { path, entries, readme };
  return c.json(listing);
});
