import { Hono } from "hono";
import type { Bindings } from "../bindings.js";
import { getDb } from "../../db/migrations.js";
import { getDataDir, listDataDirs, type DataDir } from "../../db/dataDirs.js";
import { appViewDataDirUrl } from "./list.js";

/**
 * The public, read-only data dir API: published data dirs with their files,
 * hashes, schemas and download URLs. Drafts aren't exposed.
 */
export const dataDirsRoute = new Hono<{ Bindings: Bindings }>();

export function publicDataDir(dir: DataDir, origin: string, appview: string) {
  const download = (path: string) =>
    `${origin}/api/download?path=${encodeURIComponent(`${dir.slug}/${path}`)}`;
  return {
    name: dir.slug,
    title: dir.title,
    description: dir.description,
    license: dir.license,
    tags: dir.tags,
    publishedAt: dir.publishedAt,
    recordUri: dir.recordUri,
    recordCid: dir.recordCid,
    feedUrl: dir.recordUri ? appViewDataDirUrl(appview, dir.recordUri) : null,
    readme: dir.readmeSha256 ? { url: download("README.md"), sha256: dir.readmeSha256 } : null,
    files: dir.files.map((f) => ({
      path: f.path,
      size: f.size,
      sha256: f.sha256,
      format: f.format,
      rows: f.rows,
      schema: f.schema,
      url: download(f.path),
    })),
  };
}

dataDirsRoute.get("/datadirs", async (c) => {
  const db = await getDb(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const dirs = (await listDataDirs(db)).filter((d) => d.status === "published");
  return c.json({
    dataDirs: dirs.map((d) => publicDataDir(d, origin, c.env.IGLOO_APPVIEW_URL)),
  });
});

dataDirsRoute.get("/datadirs/:name", async (c) => {
  const db = await getDb(c.env.DB);
  const dir = await getDataDir(db, c.req.param("name"));
  if (!dir || dir.status !== "published") return c.json({ error: "Not found" }, 404);
  return c.json(publicDataDir(dir, new URL(c.req.url).origin, c.env.IGLOO_APPVIEW_URL));
});
