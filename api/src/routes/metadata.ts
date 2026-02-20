import { Hono } from "hono";
import { getObjectMetadata } from "../r2.js";

export const metadataRoute = new Hono();

metadataRoute.get("/metadata", async (c) => {
  const path = c.req.query("path");
  if (!path) {
    return c.json({ error: "path parameter is required" }, 400);
  }

  try {
    const metadata = await getObjectMetadata(path);
    return c.json(metadata);
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return c.json({ error: "File not found" }, 404);
    }
    throw err;
  }
});
