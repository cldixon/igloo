/**
 * D1 schema for instance state, applied in order on first use (see migrate.ts).
 *
 * Rules, because Worker versions can roll back but D1 can't:
 * - Never edit or reorder a migration once it has shipped; add a new one.
 * - Migrations only add. Removing a column or table ships in a later release,
 *   after no deployed version reads it.
 * - One SQL statement per array entry (D1 prepares statements one at a time).
 */
export type Migration = { name: string; statements: string[] };

export const MIGRATIONS: Migration[] = [
  {
    name: "0001_data_dirs",
    statements: [
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      // A data dir is the R2 folder <slug>/. Its README, if any, is
      // <slug>/README.md, hashed separately from the data files.
      `CREATE TABLE data_dirs (
        slug TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        license TEXT,
        readme_sha256 TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        record_uri TEXT,
        record_cid TEXT,
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE data_dir_files (
        slug TEXT NOT NULL REFERENCES data_dirs (slug) ON DELETE CASCADE,
        path TEXT NOT NULL,
        size INTEGER NOT NULL CHECK (size >= 0),
        sha256 TEXT NOT NULL,
        content_type TEXT,
        uploaded_at TEXT NOT NULL,
        PRIMARY KEY (slug, path)
      )`,
      `CREATE INDEX data_dirs_by_status ON data_dirs (status, updated_at)`,
    ],
  },
];
