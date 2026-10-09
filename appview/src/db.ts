import {
  OAUTH_MIGRATION,
  WEB_SESSION_MIGRATION,
  migratedDb,
  type Migration,
} from "@igloo/platform";
import type { DataDirRecord, InstanceRecord } from "@igloo/lexicon";

/**
 * The AppView's index. Everything here can be rebuilt from the network
 * (reconcile.ts), so it is a cache of records, never a source of truth.
 */
const MIGRATIONS: Migration[] = [
  {
    name: "0001_index",
    statements: [
      `CREATE TABLE data_dirs (
        uri TEXT PRIMARY KEY,
        did TEXT NOT NULL,
        rkey TEXT NOT NULL,
        cid TEXT NOT NULL,
        instance_url TEXT NOT NULL,
        record TEXT NOT NULL,
        created_at TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      )`,
      `CREATE INDEX data_dirs_by_created ON data_dirs (created_at DESC)`,
      `CREATE INDEX data_dirs_by_did ON data_dirs (did)`,
      `CREATE TABLE instances (
        uri TEXT PRIMARY KEY,
        did TEXT NOT NULL,
        rkey TEXT NOT NULL,
        cid TEXT NOT NULL,
        url TEXT NOT NULL,
        record TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      )`,
      `CREATE INDEX instances_by_did ON instances (did)`,
      `CREATE TABLE maintainers (
        did TEXT PRIMARY KEY,
        handle TEXT,
        display_name TEXT,
        avatar TEXT,
        description TEXT,
        pds TEXT,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
];

export const ALL_MIGRATIONS = [OAUTH_MIGRATION, WEB_SESSION_MIGRATION, ...MIGRATIONS];
export const getDb = migratedDb(ALL_MIGRATIONS);

export type IndexedDataDir = {
  uri: string;
  did: string;
  rkey: string;
  cid: string;
  instanceUrl: string;
  record: DataDirRecord;
  createdAt: string;
  indexedAt: string;
};

export type IndexedInstance = {
  uri: string;
  did: string;
  rkey: string;
  cid: string;
  url: string;
  record: InstanceRecord;
  indexedAt: string;
};

export type Maintainer = {
  did: string;
  handle: string | null;
  displayName: string | null;
  avatar: string | null;
  description: string | null;
  pds: string | null;
};

type DataDirRow = {
  uri: string;
  did: string;
  rkey: string;
  cid: string;
  instance_url: string;
  record: string;
  created_at: string;
  indexed_at: string;
};

type InstanceRow = {
  uri: string;
  did: string;
  rkey: string;
  cid: string;
  url: string;
  record: string;
  indexed_at: string;
};

type MaintainerRow = {
  did: string;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
  description: string | null;
  pds: string | null;
};

const toDataDir = (r: DataDirRow): IndexedDataDir => ({
  uri: r.uri,
  did: r.did,
  rkey: r.rkey,
  cid: r.cid,
  instanceUrl: r.instance_url,
  record: JSON.parse(r.record),
  createdAt: r.created_at,
  indexedAt: r.indexed_at,
});

const toInstance = (r: InstanceRow): IndexedInstance => ({
  uri: r.uri,
  did: r.did,
  rkey: r.rkey,
  cid: r.cid,
  url: r.url,
  record: JSON.parse(r.record),
  indexedAt: r.indexed_at,
});

const toMaintainer = (r: MaintainerRow): Maintainer => ({
  did: r.did,
  handle: r.handle,
  displayName: r.display_name,
  avatar: r.avatar,
  description: r.description,
  pds: r.pds,
});

export async function upsertDataDir(
  db: D1Database,
  ref: { uri: string; did: string; rkey: string; cid: string },
  record: DataDirRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO data_dirs (uri, did, rkey, cid, instance_url, record, created_at, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (uri) DO UPDATE SET
         cid = excluded.cid, instance_url = excluded.instance_url, record = excluded.record,
         created_at = excluded.created_at, indexed_at = excluded.indexed_at`,
    )
    .bind(
      ref.uri,
      ref.did,
      ref.rkey,
      ref.cid,
      record.instance,
      JSON.stringify(record),
      record.createdAt,
      new Date().toISOString(),
    )
    .run();
}

export async function upsertInstance(
  db: D1Database,
  ref: { uri: string; did: string; rkey: string; cid: string },
  record: InstanceRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO instances (uri, did, rkey, cid, url, record, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (uri) DO UPDATE SET
         cid = excluded.cid, url = excluded.url, record = excluded.record,
         indexed_at = excluded.indexed_at`,
    )
    .bind(
      ref.uri,
      ref.did,
      ref.rkey,
      ref.cid,
      record.url,
      JSON.stringify(record),
      new Date().toISOString(),
    )
    .run();
}

export async function deleteRecord(db: D1Database, uri: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM data_dirs WHERE uri = ?").bind(uri),
    db.prepare("DELETE FROM instances WHERE uri = ?").bind(uri),
  ]);
}

export async function upsertMaintainer(db: D1Database, m: Maintainer): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO maintainers (did, handle, display_name, avatar, description, pds, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(m.did, m.handle, m.displayName, m.avatar, m.description, m.pds, new Date().toISOString())
    .run();
}

export async function getMaintainer(db: D1Database, did: string): Promise<Maintainer | null> {
  const row = await db
    .prepare("SELECT * FROM maintainers WHERE did = ?")
    .bind(did)
    .first<MaintainerRow>();
  return row ? toMaintainer(row) : null;
}

/** Maintainer rows for a set of DIDs, keyed by DID. */
export async function getMaintainers(
  db: D1Database,
  dids: string[],
): Promise<Map<string, Maintainer>> {
  const unique = [...new Set(dids)];
  if (unique.length === 0) return new Map();
  const { results } = await db
    .prepare(`SELECT * FROM maintainers WHERE did IN (${unique.map(() => "?").join(",")})`)
    .bind(...unique)
    .all<MaintainerRow>();
  return new Map(results.map((r) => [r.did, toMaintainer(r)]));
}

/** The feed: newest first, paged by createdAt. */
export async function feed(
  db: D1Database,
  { limit = 30, before }: { limit?: number; before?: string } = {},
) {
  const { results } = await db
    .prepare(
      `SELECT * FROM data_dirs WHERE (?1 IS NULL OR created_at < ?1)
       ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(before ?? null, limit)
    .all<DataDirRow>();
  return results.map(toDataDir);
}

export async function getDataDir(
  db: D1Database,
  did: string,
  rkey: string,
): Promise<IndexedDataDir | null> {
  const row = await db
    .prepare("SELECT * FROM data_dirs WHERE did = ? AND rkey = ?")
    .bind(did, rkey)
    .first<DataDirRow>();
  return row ? toDataDir(row) : null;
}

export async function dataDirsBy(db: D1Database, did: string, instanceUrl?: string) {
  const { results } = await db
    .prepare(
      `SELECT * FROM data_dirs WHERE did = ?1 AND (?2 IS NULL OR instance_url = ?2)
       ORDER BY created_at DESC`,
    )
    .bind(did, instanceUrl ?? null)
    .all<DataDirRow>();
  return results.map(toDataDir);
}

export async function getInstance(
  db: D1Database,
  did: string,
  rkey: string,
): Promise<IndexedInstance | null> {
  const row = await db
    .prepare("SELECT * FROM instances WHERE did = ? AND rkey = ?")
    .bind(did, rkey)
    .first<InstanceRow>();
  return row ? toInstance(row) : null;
}

export async function instancesBy(db: D1Database, did: string): Promise<IndexedInstance[]> {
  const { results } = await db
    .prepare("SELECT * FROM instances WHERE did = ? ORDER BY url")
    .bind(did)
    .all<InstanceRow>();
  return results.map(toInstance);
}

/** Instances keyed by "did url", to label feed items. */
export async function instancesFor(db: D1Database, pairs: { did: string; url: string }[]) {
  const dids = [...new Set(pairs.map((p) => p.did))];
  if (dids.length === 0) return new Map<string, IndexedInstance>();
  const { results } = await db
    .prepare(`SELECT * FROM instances WHERE did IN (${dids.map(() => "?").join(",")})`)
    .bind(...dids)
    .all<InstanceRow>();
  return new Map(results.map((r) => [`${r.did} ${r.url}`, toInstance(r)]));
}

/** Every indexed record URI in a collection's table, for reconcile. */
export async function indexedUris(
  db: D1Database,
  table: "data_dirs" | "instances",
): Promise<string[]> {
  const { results } = await db.prepare(`SELECT uri FROM ${table}`).all<{ uri: string }>();
  return results.map((r) => r.uri);
}
