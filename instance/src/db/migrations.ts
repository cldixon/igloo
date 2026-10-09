import {
  OAUTH_MIGRATION,
  WEB_SESSION_MIGRATION,
  migratedDb,
  type Migration,
} from "@igloo/platform";

/**
 * D1 schema for instance state, applied in order on first use. See
 * @igloo/platform's migrate.ts for the rules: never edit a shipped migration,
 * and only add.
 */

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

/** All migrations, in order. */
export const ALL_MIGRATIONS: Migration[] = [OAUTH_MIGRATION, WEB_SESSION_MIGRATION, ...MIGRATIONS];

/** The instance database, migrated on first use in each isolate. */
export const getDb = migratedDb(ALL_MIGRATIONS);
