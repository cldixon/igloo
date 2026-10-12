import type { IglooConfig } from "@igloo/shared";
import type { DataDirModel } from "@igloo/ui";

/** The public API (/api/config, /api/datadirs). Visitors never sign in. */

/** A published data dir, as /api/datadirs returns it. */
export type PublicDataDir = {
  name: string;
  title: string | null;
  description: string | null;
  license: string | null;
  tags: string[];
  publishedAt: string | null;
  recordUri: string | null;
  recordCid: string | null;
  feedUrl: string | null;
  readme: { url: string; sha256: string } | null;
  files: {
    path: string;
    size: number;
    sha256: string;
    format: string | null;
    rows: number | null;
    schema: { name: string; type: string }[] | null;
    url: string;
  }[];
};

export class NotFound extends Error {}

async function get<T>(fetcher: typeof fetch, path: string): Promise<T> {
  const res = await fetcher(path);
  if (res.status === 404) throw new NotFound(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchConfig(fetcher: typeof fetch = fetch): Promise<IglooConfig> {
  try {
    return await get<IglooConfig>(fetcher, "/api/config");
  } catch {
    return { title: "igloo", tagline: "", theme: "repo" };
  }
}

export const fetchDataDirs = (fetcher: typeof fetch = fetch) =>
  get<{ dataDirs: PublicDataDir[] }>(fetcher, "/api/datadirs").then((r) => r.dataDirs);

export const fetchDataDir = (name: string, fetcher: typeof fetch = fetch) =>
  get<PublicDataDir>(fetcher, `/api/datadirs/${encodeURIComponent(name)}`);

/** What the instance calls itself: its profile name, then its configured title. */
export function instanceName(config: IglooConfig): string {
  return config.name || (config.title !== "igloo" ? config.title : "") || location.host;
}

/** The AppView page of a person, instance or data dir, when there is an AppView. */
export function appviewUrl(config: IglooConfig, path: string): string | null {
  return config.appview ? new URL(path, config.appview).toString() : null;
}

/** A published data dir in the shape the shared data dir view renders. */
export function toModel(d: PublicDataDir, config: IglooConfig): DataDirModel {
  return {
    name: d.name,
    title: d.title,
    description: d.description,
    license: d.license,
    tags: d.tags,
    publishedAt: d.publishedAt,
    files: d.files.map((f) => ({ ...f, modified: d.publishedAt })),
    readme: d.readme,
    recordUri: d.recordUri,
    recordCid: d.recordCid,
    maintainer: config.ownerDid
      ? {
          did: config.ownerDid,
          handle: config.owner ?? null,
          href: appviewUrl(config, `/m/${config.ownerDid}`),
        }
      : null,
    instance: { name: instanceName(config), url: location.origin, href: "/" },
  };
}
