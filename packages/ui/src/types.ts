/**
 * The shapes shared components render. Each app maps its own data (instance
 * admin API, AppView index) onto these, so a data dir looks the same
 * wherever it is shown.
 */

export type Status = "live" | "dark" | "unknown";

export type Person = {
  did: string;
  handle: string | null;
  displayName?: string | null;
  avatar?: string | null;
  /** Where the person's page is, on this surface. */
  href?: string | null;
};

export type InstanceRef = {
  name: string | null;
  url: string;
  /** Where the instance's page is, on this surface. */
  href?: string | null;
  status?: Status;
};

export type DataFile = {
  path: string;
  size: number;
  sha256: string;
  format?: string | null;
  rows?: number | null;
  schema?: { name: string; type: string }[] | null;
  /** Direct download URL on the instance. */
  url?: string | null;
  modified?: string | null;
};

/** A published data dir, wherever it is shown. */
export type DataDirModel = {
  name: string;
  title: string | null;
  description: string | null;
  license: string | null;
  tags: string[];
  publishedAt: string | null;
  files: DataFile[];
  readme: { url: string; sha256: string } | null;
  recordUri: string | null;
  recordCid: string | null;
  /** The record itself, when this surface has it. */
  record?: unknown;
  maintainer: Person | null;
  instance: InstanceRef;
};

export type MenuItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
};

export type Crumb = { label: string; href?: string | null };

export type TabItem = {
  id: string;
  label: string;
  href: string;
  count?: number;
  /** Shown but not usable yet (reserved for later phases). */
  disabled?: boolean;
};
