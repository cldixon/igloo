import { Hono, type Context } from "hono";
import { NSID, instanceRkey, relativePath, validateInstance } from "@igloo/lexicon";
import { getOAuthClient } from "../../auth/client.js";
import { getSetting, setSetting } from "@igloo/platform";
import {
  DataDirError,
  README_PATH,
  createDataDir,
  deleteDataDir,
  getDataDir,
  listDataDirs,
  markPublished,
  markUnpublished,
  putFile,
  removeFile,
  setLicense,
  setFileProfile,
  setReadme,
  updateMetadata,
  type DataDir,
} from "../../db/dataDirs.js";
import { buildDataDirRecord } from "../../records.js";
import { profileFile } from "../../admin/profile.js";
import { contentTypeFor, hashObject, objectKey, sha256Text, sizedBody } from "../../admin/files.js";
import {
  PdsError,
  deleteRecord,
  notifyAppView,
  putDataDirRecord,
  putInstanceRecord,
} from "../../admin/pds.js";
import { originOf, requireOwner, type AdminEnv } from "../session.js";

/**
 * The owner's admin API. Everything here requires the owner's session
 * (requireOwner). Data files go to R2 at <slug>/<path> and are hashed there,
 * server-side, so the hashes in a record are always the bytes R2 serves.
 */
export const adminRoute = new Hono<AdminEnv>();
adminRoute.use("*", requireOwner);

/** Requests above this go through multipart upload (Workers cap request bodies at 100 MB). */
export const SINGLE_UPLOAD_LIMIT = 95 * 1024 * 1024;

const STATUS: Record<DataDirError["code"], 400 | 404 | 409> = {
  invalid: 400,
  not_found: 404,
  exists: 409,
  published: 409,
  empty: 409,
};

adminRoute.onError((error, c) => {
  if (error instanceof DataDirError) return c.json({ error: error.message }, STATUS[error.code]);
  if (error instanceof PdsError) return c.json({ error: error.message }, 502);
  console.error(error);
  return c.json({ error: "Something went wrong" }, 500);
});

type Ctx = Context<AdminEnv>;

function oauth(c: Ctx) {
  return getOAuthClient(c.var.db, originOf(c), {
    title: c.env.IGLOO_TITLE,
    signingKeySecret: c.env.OAUTH_SIGNING_KEY,
  });
}

/** Run work after the response when the runtime allows it; otherwise wait for it. */
async function background(c: Ctx, work: Promise<unknown>): Promise<void> {
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    await work;
  }
}

async function requireDir(c: Ctx, slug: string): Promise<DataDir> {
  const dir = await getDataDir(c.var.db, slug);
  if (!dir) throw new DataDirError("not_found", `No data dir "${slug}"`);
  return dir;
}

/** Refuse before touching R2: a published data dir's bytes must not change. */
async function requireDraftDir(c: Ctx, slug: string): Promise<DataDir> {
  const dir = await requireDir(c, slug);
  if (dir.status === "published") {
    throw new DataDirError(
      "published",
      `"${slug}" is published, so its files can't change. Unpublish it first.`,
    );
  }
  return dir;
}

function requirePath(path: string | undefined): string {
  if (!path || !relativePath.safeParse(path).success) {
    throw new DataDirError("invalid", `"${path ?? ""}" is not a valid path inside a data dir`);
  }
  if (path === README_PATH) {
    throw new DataDirError("invalid", `${README_PATH} is the data dir's README, not a data file`);
  }
  return path;
}

/** Write (or rewrite) the data dir's record on the PDS, then tell the AppView. */
async function publishRecord(c: Ctx, dir: DataDir): Promise<DataDir> {
  if (dir.files.length === 0) {
    throw new DataDirError("empty", `"${dir.slug}" has no data files to publish`);
  }
  const built = buildDataDirRecord(dir, originOf(c));
  if (!built.ok) {
    throw new DataDirError("invalid", `Can't publish yet: ${built.errors.join("; ")}`);
  }
  const ref = await putDataDirRecord(await oauth(c), c.var.ownerDid, built.value);
  const updated = await markPublished(c.var.db, dir.slug, {
    ...ref,
    publishedAt: built.value.createdAt,
  });
  await background(c, notifyAppView(c.env.IGLOO_APPVIEW_URL, ref.uri));
  return updated;
}

/** After an edit: keep a published data dir's record in step. */
async function syncRecord(c: Ctx, dir: DataDir): Promise<DataDir> {
  return dir.status === "published" ? publishRecord(c, dir) : dir;
}

/** Objects under <slug>/ that aren't registered data files: candidates to add. */
async function unregisteredObjects(c: Ctx, dir: DataDir) {
  const known = new Set([...dir.files.map((f) => f.path), README_PATH]);
  const found: { path: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await c.env.DATA.list({ prefix: `${dir.slug}/`, cursor });
    for (const obj of page.objects) {
      const path = obj.key.slice(dir.slug.length + 1);
      if (path && !path.endsWith("/") && !known.has(path) && relativePath.safeParse(path).success) {
        found.push({ path, size: obj.size });
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && found.length < 1000);
  return found;
}

// --- Data dirs --------------------------------------------------------------

adminRoute.get("/datadirs", async (c) => {
  return c.json({ dataDirs: await listDataDirs(c.var.db) });
});

/** Top-level folders in the bucket that aren't data dirs yet. */
adminRoute.get("/folders", async (c) => {
  const dirs = new Set((await listDataDirs(c.var.db)).map((d) => d.slug));
  const folders: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await c.env.DATA.list({ delimiter: "/", cursor });
    for (const prefix of page.delimitedPrefixes) {
      const name = prefix.replace(/\/$/, "");
      if (!dirs.has(name)) folders.push(name);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return c.json({ folders });
});

adminRoute.post("/datadirs", async (c) => {
  const body = await c.req.json<{
    slug?: string;
    title?: string;
    description?: string;
    license?: string;
  }>();
  const dir = await createDataDir(c.var.db, body.slug?.trim() ?? "", body);
  return c.json({ dataDir: dir }, 201);
});

adminRoute.get("/datadirs/:slug", async (c) => {
  const dir = await requireDir(c, c.req.param("slug"));
  const readme = await c.env.DATA.get(objectKey(dir.slug, README_PATH));
  return c.json({
    dataDir: dir,
    readme: readme ? await readme.text() : null,
    unregistered: await unregisteredObjects(c, dir),
  });
});

adminRoute.patch("/datadirs/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<{
    title?: string | null;
    description?: string | null;
    license?: string | null;
    tags?: string[];
  }>();
  let dir = await requireDir(c, slug);
  if (body.license !== undefined && (body.license ?? null) !== dir.license) {
    dir = await setLicense(c.var.db, slug, body.license);
  }
  if (body.title !== undefined || body.description !== undefined || body.tags !== undefined) {
    dir = await updateMetadata(c.var.db, slug, body);
  }
  return c.json({ dataDir: await syncRecord(c, dir) });
});

/** Forget a draft data dir. Its files stay in the bucket. */
adminRoute.delete("/datadirs/:slug", async (c) => {
  await deleteDataDir(c.var.db, c.req.param("slug"));
  return c.json({ ok: true });
});

// --- Files ------------------------------------------------------------------

/** Hash an object that is already in R2 and add it to the data dir. */
async function register(c: Ctx, slug: string, path: string): Promise<DataDir> {
  const key = objectKey(slug, path);
  const hashed = await hashObject(c.env.DATA, key);
  if (!hashed) throw new DataDirError("not_found", `No file at ${slug}/${path}`);
  return putFile(c.var.db, slug, {
    path,
    size: hashed.size,
    sha256: hashed.sha256,
    contentType: hashed.contentType,
    profile: await profileFile(c.env.DATA, key, hashed.size),
  });
}

/** Upload one file in a single request (up to SINGLE_UPLOAD_LIMIT). */
adminRoute.put("/datadirs/:slug/files", async (c) => {
  const slug = c.req.param("slug");
  const path = requirePath(c.req.query("path"));
  await requireDraftDir(c, slug);
  const length = Number(c.req.header("content-length"));
  if (!Number.isFinite(length)) return c.json({ error: "Content-Length is required" }, 411);
  if (length > SINGLE_UPLOAD_LIMIT) {
    return c.json({ error: "Too large for one request: use a multipart upload" }, 413);
  }
  await c.env.DATA.put(objectKey(slug, path), await sizedBody(c.req.raw, length), {
    httpMetadata: { contentType: contentTypeFor(path, c.req.header("content-type")) },
  });
  return c.json({ dataDir: await register(c, slug, path) });
});

/** Add files that are already in the bucket under the data dir's folder. */
adminRoute.post("/datadirs/:slug/files/register", async (c) => {
  const slug = c.req.param("slug");
  const { paths } = await c.req.json<{ paths?: string[] }>();
  await requireDraftDir(c, slug);
  let dir: DataDir | undefined;
  for (const path of paths ?? []) dir = await register(c, slug, requirePath(path));
  return c.json({ dataDir: dir ?? (await requireDir(c, slug)) });
});

/**
 * Record a file's format, row count and schema, as measured by DuckDB in the
 * owner's browser (CSV and JSON have no footer the server can read). Allowed
 * while published: it describes the bytes without changing them.
 */
adminRoute.put("/datadirs/:slug/files/profile", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<{
    path?: string;
    format?: string | null;
    rows?: number | null;
    schema?: { name: string; type: string }[] | null;
  }>();
  const path = requirePath(body.path);
  const dir = await setFileProfile(c.var.db, slug, path, {
    format: body.format ?? null,
    rows: body.rows ?? null,
    schema: body.schema ?? null,
  });
  return c.json({ dataDir: await syncRecord(c, dir) });
});

/** Remove a file from the data dir and delete it from the bucket. */
adminRoute.delete("/datadirs/:slug/files", async (c) => {
  const slug = c.req.param("slug");
  const path = requirePath(c.req.query("path"));
  await requireDraftDir(c, slug);
  const dir = await removeFile(c.var.db, slug, path);
  await c.env.DATA.delete(objectKey(slug, path));
  return c.json({ dataDir: dir });
});

// Multipart upload, for files over SINGLE_UPLOAD_LIMIT. Parts must be at
// least 5 MB except the last; the client sends them in order.

adminRoute.post("/datadirs/:slug/uploads", async (c) => {
  const slug = c.req.param("slug");
  const { path: rawPath, contentType } = await c.req.json<{
    path?: string;
    contentType?: string;
  }>();
  const path = requirePath(rawPath);
  await requireDraftDir(c, slug);
  const upload = await c.env.DATA.createMultipartUpload(objectKey(slug, path), {
    httpMetadata: { contentType: contentTypeFor(path, contentType) },
  });
  return c.json({ uploadId: upload.uploadId, path });
});

adminRoute.put("/datadirs/:slug/uploads/:uploadId", async (c) => {
  const slug = c.req.param("slug");
  const path = requirePath(c.req.query("path"));
  const partNumber = Number(c.req.query("part"));
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
    return c.json({ error: "part must be 1–10000" }, 400);
  }
  const length = Number(c.req.header("content-length"));
  if (!Number.isFinite(length)) return c.json({ error: "Content-Length is required" }, 411);
  await requireDraftDir(c, slug);
  const upload = c.env.DATA.resumeMultipartUpload(objectKey(slug, path), c.req.param("uploadId"));
  const part = await upload.uploadPart(partNumber, await sizedBody(c.req.raw, length));
  return c.json(part);
});

adminRoute.post("/datadirs/:slug/uploads/:uploadId/complete", async (c) => {
  const slug = c.req.param("slug");
  const { path: rawPath, parts } = await c.req.json<{
    path?: string;
    parts?: { partNumber: number; etag: string }[];
  }>();
  const path = requirePath(rawPath);
  await requireDraftDir(c, slug);
  const upload = c.env.DATA.resumeMultipartUpload(objectKey(slug, path), c.req.param("uploadId"));
  await upload.complete(parts ?? []);
  return c.json({ dataDir: await register(c, slug, path) });
});

adminRoute.delete("/datadirs/:slug/uploads/:uploadId", async (c) => {
  const slug = c.req.param("slug");
  const path = requirePath(c.req.query("path"));
  await c.env.DATA.resumeMultipartUpload(objectKey(slug, path), c.req.param("uploadId")).abort();
  return c.json({ ok: true });
});

// --- README -----------------------------------------------------------------

/** The README is editable while published; the record is updated with its new hash. */
adminRoute.put("/datadirs/:slug/readme", async (c) => {
  const slug = c.req.param("slug");
  await requireDir(c, slug);
  const text = await c.req.text();
  if (!text.trim()) return c.json({ error: "The README is empty; delete it instead" }, 400);
  await c.env.DATA.put(objectKey(slug, README_PATH), text, {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
  });
  const dir = await setReadme(c.var.db, slug, await sha256Text(text));
  return c.json({ dataDir: await syncRecord(c, dir) });
});

adminRoute.delete("/datadirs/:slug/readme", async (c) => {
  const slug = c.req.param("slug");
  await requireDir(c, slug);
  await c.env.DATA.delete(objectKey(slug, README_PATH));
  const dir = await setReadme(c.var.db, slug, null);
  return c.json({ dataDir: await syncRecord(c, dir) });
});

// --- Publishing -------------------------------------------------------------

adminRoute.post("/datadirs/:slug/publish", async (c) => {
  const dir = await requireDir(c, c.req.param("slug"));
  return c.json({ dataDir: await publishRecord(c, dir) });
});

adminRoute.post("/datadirs/:slug/unpublish", async (c) => {
  const dir = await requireDir(c, c.req.param("slug"));
  if (dir.status !== "published") return c.json({ dataDir: dir });
  await deleteRecord(await oauth(c), c.var.ownerDid, NSID.dataDir, dir.slug);
  const updated = await markUnpublished(c.var.db, dir.slug);
  if (dir.recordUri) await background(c, notifyAppView(c.env.IGLOO_APPVIEW_URL, dir.recordUri));
  return c.json({ dataDir: updated });
});

// --- Instance profile -------------------------------------------------------

async function instanceProfile(c: Ctx) {
  const db = c.var.db;
  const [name, description, recordUri, createdAt] = await Promise.all([
    getSetting(db, "instance_name"),
    getSetting(db, "instance_description"),
    getSetting(db, "instance_record_uri"),
    getSetting(db, "instance_created_at"),
  ]);
  return { url: originOf(c), name, description, recordUri, createdAt };
}

adminRoute.get("/instance", async (c) => c.json({ instance: await instanceProfile(c) }));

/** Save the instance's name and description, and publish them as its instance record. */
adminRoute.put("/instance", async (c) => {
  const body = await c.req.json<{ name?: string; description?: string }>();
  const db = c.var.db;
  const current = await instanceProfile(c);
  const record = {
    $type: NSID.instance,
    url: current.url,
    name: body.name?.trim() ?? "",
    ...(body.description?.trim() && { description: body.description.trim() }),
    createdAt: current.createdAt ?? new Date().toISOString(),
  };
  const valid = validateInstance(record);
  if (!valid.ok) return c.json({ error: valid.errors.join("; ") }, 400);
  const ref = await putInstanceRecord(await oauth(c), c.var.ownerDid, valid.value);
  await Promise.all([
    setSetting(db, "instance_name", valid.value.name),
    setSetting(db, "instance_description", valid.value.description ?? ""),
    setSetting(db, "instance_record_uri", ref.uri),
    setSetting(db, "instance_created_at", valid.value.createdAt),
  ]);
  await background(c, notifyAppView(c.env.IGLOO_APPVIEW_URL, ref.uri));
  return c.json({ instance: await instanceProfile(c) });
});

// --- Network status ---------------------------------------------------------

adminRoute.get("/network", async (c) => {
  let pds: { ok: boolean; error?: string } = { ok: true };
  try {
    const session = await (await oauth(c)).restore(c.var.ownerDid);
    await session.getTokenInfo();
  } catch {
    pds = { ok: false, error: "Not connected. Sign out and back in to reconnect." };
  }
  const dirs = await listDataDirs(c.var.db);
  return c.json({
    owner: c.var.ownerDid,
    pds,
    appview: c.env.IGLOO_APPVIEW_URL,
    instanceRkey: instanceRkey(originOf(c)),
    dataDirs: {
      total: dirs.length,
      published: dirs.filter((d) => d.status === "published").length,
    },
    storageBytes: dirs.flatMap((d) => d.files).reduce((sum, f) => sum + f.size, 0),
  });
});
