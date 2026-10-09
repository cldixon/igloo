import { Hono } from "hono";
import { getObjectMetadata } from "../storage.js";
import type { Bindings } from "../bindings.js";

export const metadataRoute = new Hono<{ Bindings: Bindings }>();

metadataRoute.get("/metadata", async (c) => {
  const path = c.req.query("path");
  if (!path) {
    return c.json({ error: "path parameter is required" }, 400);
  }

  const metadata = await getObjectMetadata(c.env.DATA, path);
  if (!metadata) {
    return c.json({ error: "File not found" }, 404);
  }

  return c.json(metadata);
});
