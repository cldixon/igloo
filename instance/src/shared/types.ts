export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  lastModified?: string;
  extension?: string;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
  readme?: string | null;
  /** Set when this folder is a published data dir. */
  dataDir?: PublishedDataDir | null;
  /** At the root: which top-level folders are published data dirs. */
  publishedDirs?: string[];
}

/** What the public site shows about a published data dir. Drafts aren't exposed. */
export interface PublishedDataDir {
  slug: string;
  title: string | null;
  description: string | null;
  license: string | null;
  recordUri: string;
  /** The data dir's page on the AppView. */
  feedUrl: string;
  publishedAt: string | null;
  /** sha256 by file path, as published in the record. */
  hashes: Record<string, string>;
}

export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  contentType: string;
  etag?: string;
}

export type VisualTheme = "repo" | "index";
export type ColorMode = "light" | "dark";

export interface IglooConfig {
  title: string;
  tagline: string;
  theme: VisualTheme;
}

/** A data dir as the admin API returns it. */
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
