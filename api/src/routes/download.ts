import { Hono } from "hono";
import { stream } from "hono/streaming";
import { getObject } from "../r2.js";

export const downloadRoute = new Hono();

downloadRoute.get("/download", async (c) => {
  const path = c.req.query("path");
  if (!path) {
    return c.json({ error: "path parameter is required" }, 400);
  }

  try {
    const response = await getObject(path);
    const fileName = path.split("/").pop() ?? "download";

    c.header(
      "Content-Type",
      response.ContentType ?? "application/octet-stream"
    );
    c.header("Content-Disposition", `attachment; filename="${fileName}"`);
    if (response.ContentLength) {
      c.header("Content-Length", response.ContentLength.toString());
    }

    return stream(c, async (s) => {
      if (response.Body) {
        const readable = response.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of readable) {
          await s.write(chunk);
        }
      }
    });
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return c.json({ error: "File not found" }, 404);
    }
    throw err;
  }
});
