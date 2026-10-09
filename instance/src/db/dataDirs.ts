import { isSlug, relativePath, sha256Hex } from "@igloo/lexicon";

/**
 * Instance state for data dirs.
 *
 * While a data dir is published, its files and license are fixed: they are
 * what the record's hashes and citations point at. Title, description and
 * README stay editable; each edit is followed by a record update. Unpublishing
 * deletes the record and makes the data dir a draft again.
 */

export type DataDirStatus = "draft" | "published";

export type DataDirFile = {
  path: string;
  size: number;
  sha256: string;
  contentType: string | null;
  uploadedAt: string;
};

export type DataDir = {
  slug: string;
  title: string | null;
  description: string | null;
  license: string | null;
  readmeSha256: string | null;
  status: DataDirStatus;
  recordUri: string | null;
  recordCid: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  files: DataDirFile[];
};

/** Where a data dir's README lives, relative to the data dir. */
export const README_PATH = "README.md";

export type DataDirErrorCode = "invalid" | "not_found" | "exists" | "published" | "empty";

export class DataDirError extends Error {
  constructor(
    readonly code: DataDirErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DataDirError";
  }
}

type DataDirRow = {
  slug: string;
  title: string | null;
  description: string | null;
  license: string | null;
  readme_sha256: string | null;
  status: DataDirStatus;
  record_uri: string | null;
  record_cid: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type FileRow = {
  slug: string;
  path: string;
  size: number;
  sha256: string;
  content_type: string | null;
  uploaded_at: string;
};

function toDataDir(row: DataDirRow, files: FileRow[]): DataDir {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    license: row.license,
    readmeSha256: row.readme_sha256,
    status: row.status,
    recordUri: row.record_uri,
    recordCid: row.record_cid,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    files: files.map((f) => ({
      path: f.path,
      size: f.size,
      sha256: f.sha256,
      contentType: f.content_type,
      uploadedAt: f.uploaded_at,
    })),
  };
}

const now = () => new Date().toISOString();

/** Empty strings are stored as NULL, so "cleared" and "never set" read the same. */
const orNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

export async function getDataDir(db: D1Database, slug: string): Promise<DataDir | null> {
  const [dirs, files] = await db.batch<DataDirRow | FileRow>([
    db.prepare("SELECT * FROM data_dirs WHERE slug = ?").bind(slug),
    db.prepare("SELECT * FROM data_dir_files WHERE slug = ? ORDER BY path").bind(slug),
  ]);
  const row = dirs?.results[0] as DataDirRow | undefined;
  return row ? toDataDir(row, (files?.results ?? []) as FileRow[]) : null;
}

async function requireDataDir(db: D1Database, slug: string): Promise<DataDir> {
  const dir = await getDataDir(db, slug);
  if (!dir) throw new DataDirError("not_found", `No data dir "${slug}"`);
  return dir;
}

async function requireDraft(db: D1Database, slug: string, change: string): Promise<DataDir> {
  const dir = await requireDataDir(db, slug);
  if (dir.status === "published") {
    throw new DataDirError(
      "published",
      `"${slug}" is published, so its ${change} can't change. Unpublish it first.`,
    );
  }
  return dir;
}

export async function listDataDirs(db: D1Database): Promise<DataDir[]> {
  const [dirs, files] = await db.batch<DataDirRow | FileRow>([
    db.prepare("SELECT * FROM data_dirs ORDER BY slug"),
    db.prepare("SELECT * FROM data_dir_files ORDER BY slug, path"),
  ]);
  const bySlug = new Map<string, FileRow[]>();
  for (const file of (files?.results ?? []) as FileRow[]) {
    bySlug.set(file.slug, [...(bySlug.get(file.slug) ?? []), file]);
  }
  return ((dirs?.results ?? []) as DataDirRow[]).map((row) =>
    toDataDir(row, bySlug.get(row.slug) ?? []),
  );
}

export type DataDirMetadata = {
  title?: string | null;
  description?: string | null;
};

export async function createDataDir(
  db: D1Database,
  slug: string,
  metadata: DataDirMetadata & { license?: string | null } = {},
): Promise<DataDir> {
  if (!isSlug(slug)) {
    throw new DataDirError(
      "invalid",
      `"${slug}" is not a valid data dir name: use 1–64 lowercase letters, digits, ".", "_" or "-", starting and ending with a letter or digit`,
    );
  }
  const at = now();
  try {
    await db
      .prepare(
        `INSERT INTO data_dirs (slug, title, description, license, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        slug,
        orNull(metadata.title),
        orNull(metadata.description),
        orNull(metadata.license),
        at,
        at,
      )
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      throw new DataDirError("exists", `A data dir named "${slug}" already exists`);
    }
    throw error;
  }
  return requireDataDir(db, slug);
}

/** Title and description: editable at any time. */
export async function updateMetadata(
  db: D1Database,
  slug: string,
  metadata: DataDirMetadata,
): Promise<DataDir> {
  const dir = await requireDataDir(db, slug);
  await db
    .prepare("UPDATE data_dirs SET title = ?, description = ?, updated_at = ? WHERE slug = ?")
    .bind(
      metadata.title === undefined ? dir.title : orNull(metadata.title),
      metadata.description === undefined ? dir.description : orNull(metadata.description),
      now(),
      slug,
    )
    .run();
  return requireDataDir(db, slug);
}

export async function setLicense(
  db: D1Database,
  slug: string,
  license: string | null,
): Promise<DataDir> {
  await requireDraft(db, slug, "license");
  await db
    .prepare("UPDATE data_dirs SET license = ?, updated_at = ? WHERE slug = ?")
    .bind(orNull(license), now(), slug)
    .run();
  return requireDataDir(db, slug);
}

/** The README's hash, or null when the data dir has none. Editable at any time. */
export async function setReadme(
  db: D1Database,
  slug: string,
  sha256: string | null,
): Promise<DataDir> {
  if (sha256 !== null && !sha256Hex.safeParse(sha256).success) {
    throw new DataDirError("invalid", "README hash must be a lowercase hex sha256");
  }
  await requireDataDir(db, slug);
  await db
    .prepare("UPDATE data_dirs SET readme_sha256 = ?, updated_at = ? WHERE slug = ?")
    .bind(sha256, now(), slug)
    .run();
  return requireDataDir(db, slug);
}

export type NewFile = {
  path: string;
  size: number;
  sha256: string;
  contentType?: string | null;
};

/** Record a data file (after it has been written to R2 and hashed). Replaces any file at that path. */
export async function putFile(db: D1Database, slug: string, file: NewFile): Promise<DataDir> {
  if (!relativePath.safeParse(file.path).success) {
    throw new DataDirError("invalid", `"${file.path}" is not a valid path inside a data dir`);
  }
  if (file.path === README_PATH) {
    throw new DataDirError("invalid", `${README_PATH} is the data dir's README, not a data file`);
  }
  if (!sha256Hex.safeParse(file.sha256).success) {
    throw new DataDirError("invalid", "File hash must be a lowercase hex sha256");
  }
  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    throw new DataDirError("invalid", "File size must be a non-negative integer");
  }
  await requireDraft(db, slug, "files");
  const at = now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO data_dir_files (slug, path, size, sha256, content_type, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (slug, path) DO UPDATE SET
           size = excluded.size,
           sha256 = excluded.sha256,
           content_type = excluded.content_type,
           uploaded_at = excluded.uploaded_at`,
      )
      .bind(slug, file.path, file.size, file.sha256, file.contentType ?? null, at),
    db.prepare("UPDATE data_dirs SET updated_at = ? WHERE slug = ?").bind(at, slug),
  ]);
  return requireDataDir(db, slug);
}

export async function removeFile(db: D1Database, slug: string, path: string): Promise<DataDir> {
  await requireDraft(db, slug, "files");
  const at = now();
  await db.batch([
    db.prepare("DELETE FROM data_dir_files WHERE slug = ? AND path = ?").bind(slug, path),
    db.prepare("UPDATE data_dirs SET updated_at = ? WHERE slug = ?").bind(at, slug),
  ]);
  return requireDataDir(db, slug);
}

/** Only drafts can be deleted; unpublish first so the record goes too. */
export async function deleteDataDir(db: D1Database, slug: string): Promise<void> {
  await requireDraft(db, slug, "contents");
  await db.prepare("DELETE FROM data_dirs WHERE slug = ?").bind(slug).run();
}

/**
 * Record a successful publish or record update. `publishedAt` is the
 * record's createdAt and is kept across later metadata updates.
 */
export async function markPublished(
  db: D1Database,
  slug: string,
  record: { uri: string; cid: string; publishedAt: string },
): Promise<DataDir> {
  const dir = await requireDataDir(db, slug);
  if (dir.files.length === 0) {
    throw new DataDirError("empty", `"${slug}" has no data files to publish`);
  }
  await db
    .prepare(
      `UPDATE data_dirs
       SET status = 'published', record_uri = ?, record_cid = ?, published_at = ?, updated_at = ?
       WHERE slug = ?`,
    )
    .bind(record.uri, record.cid, dir.publishedAt ?? record.publishedAt, now(), slug)
    .run();
  return requireDataDir(db, slug);
}

/** Record that the data dir's record was deleted from the PDS. */
export async function markUnpublished(db: D1Database, slug: string): Promise<DataDir> {
  await requireDataDir(db, slug);
  await db
    .prepare(
      `UPDATE data_dirs
       SET status = 'draft', record_uri = NULL, record_cid = NULL, published_at = NULL, updated_at = ?
       WHERE slug = ?`,
    )
    .bind(now(), slug)
    .run();
  return requireDataDir(db, slug);
}
