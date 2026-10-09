import { Hono } from "hono";
import { getObject } from "../storage.js";
import type { Bindings } from "../bindings.js";

export const downloadRoute = new Hono<{ Bindings: Bindings }>();

downloadRoute.get("/download", async (c) => {
  const path = c.req.query("path");
  if (!path) {
    return c.json({ error: "path parameter is required" }, 400);
  }

  const object = await getObject(c.env.DATA, path);
  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const fileName = path.split("/").pop() ?? "download";
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-length", object.size.toString());
  headers.set("content-disposition", `attachment; filename="${fileName}"`);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }

  return new Response(object.body, { headers });
});
