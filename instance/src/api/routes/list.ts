import { Hono } from "hono";
import { parseAtUri } from "@igloo/lexicon";
import { listObjects, getReadme } from "../storage.js";
import type { Bindings } from "../bindings.js";
import type { DirectoryListing, PublishedDataDir } from "../../shared/types.js";
import { getDb } from "../../db/migrations.js";
import { getDataDir, listDataDirs, type DataDir } from "../../db/dataDirs.js";

export const listRoute = new Hono<{ Bindings: Bindings }>();

export function appViewDataDirUrl(appview: string, recordUri: string): string {
  const uri = parseAtUri(recordUri);
  return uri ? new URL(`/d/${uri.did}/${uri.rkey}`, appview).toString() : appview;
}

function published(dir: DataDir | null, appview: string): PublishedDataDir | null {
  if (!dir || dir.status !== "published" || !dir.recordUri) return null;
  return {
    slug: dir.slug,
    title: dir.title,
    description: dir.description,
    license: dir.license,
    recordUri: dir.recordUri,
    feedUrl: appViewDataDirUrl(appview, dir.recordUri),
    publishedAt: dir.publishedAt,
    hashes: Object.fromEntries(dir.files.map((f) => [f.path, f.sha256])),
  };
}

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

  // Data dirs are top-level folders. A nested folder inside one shows its hashes too.
  if (c.env.DB) {
    const db = await getDb(c.env.DB);
    if (!path) {
      listing.publishedDirs = (await listDataDirs(db))
        .filter((d) => d.status === "published")
        .map((d) => d.slug);
    } else {
      const slug = path.split("/")[0]!;
      const dir = published(await getDataDir(db, slug), c.env.IGLOO_APPVIEW_URL);
      if (dir) {
        const inner = path.slice(slug.length + 1);
        dir.hashes = Object.fromEntries(
          Object.entries(dir.hashes)
            .filter(([p]) => p.startsWith(inner))
            .map(([p, h]) => [p.slice(inner.length), h]),
        );
        listing.dataDir = dir;
      }
    }
  }

  return c.json(listing);
});
