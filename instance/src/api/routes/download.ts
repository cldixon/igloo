import { Hono, type Context } from "hono";
import type { Bindings } from "../bindings.js";

export const downloadRoute = new Hono<{ Bindings: Bindings }>();

export type ByteRange = { offset: number; length?: number } | { suffix: number };

/**
 * Parse a single-range `Range: bytes=…` header. Multiple ranges aren't
 * supported (the full file is served instead); a range past the end of the
 * file is unsatisfiable.
 */
export function parseRange(
  header: string | undefined,
  size: number,
): ByteRange | "unsatisfiable" | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match) return null;
  const [, start, end] = match;
  if (start === "" && end === "") return null;
  if (start === "") {
    const suffix = Number(end);
    if (suffix === 0) return "unsatisfiable";
    return { suffix: Math.min(suffix, size) };
  }
  const offset = Number(start);
  if (offset >= size) return "unsatisfiable";
  if (end === "") return { offset };
  const last = Math.min(Number(end), size - 1);
  if (last < offset) return "unsatisfiable";
  return { offset, length: last - offset + 1 };
}

function baseHeaders(object: R2Object, path: string): Headers {
  const headers = new Headers();
  // Copied field by field rather than with writeHttpMetadata, which only
  // accepts the runtime's own Headers (and so fails in tests).
  const meta = object.httpMetadata ?? {};
  if (meta.contentType) headers.set("content-type", meta.contentType);
  if (meta.contentEncoding) headers.set("content-encoding", meta.contentEncoding);
  if (meta.contentLanguage) headers.set("content-language", meta.contentLanguage);
  if (meta.cacheControl) headers.set("cache-control", meta.cacheControl);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("last-modified", object.uploaded.toUTCString());
  const fileName = path.split("/").pop() ?? "download";
  headers.set("content-disposition", `attachment; filename="${fileName.replace(/"/g, "")}"`);
  if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");
  return headers;
}

/**
 * File downloads, with HEAD and byte ranges so in-browser engines (DuckDB)
 * can read just the parts of a Parquet file a query needs.
 */
async function download(c: Context<{ Bindings: Bindings }>, headOnly: boolean) {
  const path = c.req.query("path");
  if (!path) return c.json({ error: "path parameter is required" }, 400);

  const meta = await c.env.DATA.head(path);
  if (!meta) return c.json({ error: "File not found" }, 404);
  const headers = baseHeaders(meta, path);

  const range = parseRange(c.req.header("range"), meta.size);
  if (range === "unsatisfiable") {
    headers.set("content-range", `bytes */${meta.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (headOnly) {
    headers.set("content-length", String(meta.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await c.env.DATA.get(path, range ? { range } : undefined);
  if (!object) return c.json({ error: "File not found" }, 404);

  if (!range) {
    headers.set("content-length", String(object.size));
    return new Response(object.body, { status: 200, headers });
  }
  const offset = "suffix" in range ? object.size - range.suffix : range.offset;
  const length = "suffix" in range ? range.suffix : (range.length ?? object.size - range.offset);
  headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
  headers.set("content-length", String(length));
  return new Response(object.body, { status: 206, headers });
}

downloadRoute.on("HEAD", "/download", (c) => download(c, true));
downloadRoute.get("/download", (c) => download(c, false));
