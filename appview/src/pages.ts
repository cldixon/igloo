import type { DataDirModel, Person } from "@igloo/ui/types";
import {
  dataDirsBy,
  feed,
  getDataDir,
  getInstance,
  getMaintainer,
  getMaintainers,
  instanceDirectory,
  instancesBy,
  instancesFor,
  parseSearch,
  randomDataDir,
  searchDataDirs,
  topTags,
  type IndexedDataDir,
  type IndexedInstance,
  type Maintainer,
} from "./db.js";
import { dataDirPath, downloadUrl, instancePath, maintainerPath } from "./paths.js";

/**
 * What each AppView page shows, read from the index. Plain data, so the
 * SvelteKit routes stay thin and this is testable without rendering.
 * Everything here came from other people's records: it is rendered as text.
 */

export const FEED_PAGE_SIZE = 30;

export function person(did: string, m: Maintainer | null | undefined): Person {
  return {
    did,
    handle: m?.handle ?? null,
    displayName: m?.displayName ?? null,
    avatar: m?.avatar ?? null,
    href: maintainerPath(did),
  };
}

const size = (d: IndexedDataDir) => d.record.files.reduce((sum, f) => sum + f.size, 0);

/** A feed or search entry: one data dir with who published it, and where. */
export type Entry = {
  href: string;
  name: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  files: number;
  bytes: number;
  formats: string[];
  license: string | null;
  actor: Person;
  instance: { name: string | null; url: string; href: string };
};

function entries(
  items: IndexedDataDir[],
  maintainers: Map<string, Maintainer>,
  instances: Map<string, IndexedInstance>,
): Entry[] {
  return items.map((d) => ({
    href: dataDirPath(d),
    name: d.record.name,
    title: d.record.title ?? null,
    description: d.record.description ?? null,
    createdAt: d.record.createdAt,
    files: d.record.files.length,
    bytes: size(d),
    formats: [...new Set(d.record.files.map((f) => f.format).filter((f): f is string => !!f))],
    license: d.record.license ?? null,
    actor: person(d.did, maintainers.get(d.did)),
    instance: {
      name: instances.get(`${d.did} ${d.instanceUrl}`)?.record.name ?? null,
      url: d.instanceUrl,
      href: instancePath(d.did, d.instanceUrl),
    },
  }));
}

async function withPeople(db: D1Database, items: IndexedDataDir[]): Promise<Entry[]> {
  const [maintainers, instances] = await Promise.all([
    getMaintainers(
      db,
      items.map((d) => d.did),
    ),
    instancesFor(
      db,
      items.map((d) => ({ did: d.did, url: d.instanceUrl })),
    ),
  ]);
  return entries(items, maintainers, instances);
}

export async function homePage(db: D1Database, before?: string | null, viewerDid?: string | null) {
  const [items, directory, yours] = await Promise.all([
    feed(db, { limit: FEED_PAGE_SIZE, before: before ?? undefined }),
    instanceDirectory(db),
    viewerDid ? instancesBy(db, viewerDid) : Promise.resolve([]),
  ]);
  return {
    entries: await withPeople(db, items),
    next: items.length === FEED_PAGE_SIZE ? items.at(-1)!.createdAt : null,
    instances: directory.slice(0, 6).map((i) => ({
      name: i.record.name,
      url: i.url,
      href: instancePath(i.did, i.url),
      dataDirs: i.dataDirs,
    })),
    newest: [...directory]
      .sort((a, b) => (b.record.createdAt ?? "").localeCompare(a.record.createdAt ?? ""))
      .slice(0, 4)
      .map((i) => ({ name: i.record.name, url: i.url, href: instancePath(i.did, i.url) })),
    instanceCount: directory.length,
    yours: yours.map((i) => ({
      name: i.record.name,
      url: i.url,
      href: instancePath(i.did, i.url),
    })),
  };
}

/** Narrowing a search beyond the query: format, license and size. */
export type Facets = { formats: string[]; licenses: string[]; size: "" | "s" | "m" | "l" };

const SIZES = { s: [0, 100 * 2 ** 20], m: [100 * 2 ** 20, 2 ** 30], l: [2 ** 30, Infinity] };

export async function searchPage(
  db: D1Database,
  q: string,
  facets: Facets,
  sort: "newest" | "size" = "newest",
) {
  const query = q.trim().slice(0, 200);
  const all = query ? await withPeople(db, await searchDataDirs(db, parseSearch(query))) : [];
  const count = (values: string[]) =>
    [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, n]) => ({ value, count: n }));
  const shown = all
    .filter((e) => facets.formats.length === 0 || e.formats.some((f) => facets.formats.includes(f)))
    .filter((e) => facets.licenses.length === 0 || facets.licenses.includes(e.license ?? ""))
    .filter((e) => {
      if (!facets.size) return true;
      const [min, max] = SIZES[facets.size];
      return e.bytes >= min! && e.bytes < max!;
    })
    .sort((a, b) => (sort === "size" ? b.bytes - a.bytes : 0));
  return {
    q: query,
    results: shown,
    total: all.length,
    formats: count(all.flatMap((e) => e.formats)),
    licenses: count(all.map((e) => e.license).filter((l): l is string => !!l)),
  };
}

export async function discoverPage(db: D1Database) {
  const [tags, random, directory] = await Promise.all([
    topTags(db),
    randomDataDir(db),
    instanceDirectory(db),
  ]);
  return {
    tags,
    random: random ? (await withPeople(db, [random]))[0]! : null,
    bySize: [...directory]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .map((i) => ({
        name: i.record.name,
        url: i.url,
        href: instancePath(i.did, i.url),
        dataDirs: i.dataDirs,
        bytes: i.bytes,
      })),
  };
}

/** A published data dir in the shape the shared data dir view renders. */
export function dataDirModel(
  d: IndexedDataDir,
  maintainer: Maintainer | null,
  instance: IndexedInstance | null,
): DataDirModel {
  const r = d.record;
  const url = (path: string) => downloadUrl(d.instanceUrl, r.name, path);
  return {
    name: r.name,
    title: r.title ?? null,
    description: r.description ?? null,
    license: r.license ?? null,
    tags: r.tags ?? [],
    publishedAt: r.createdAt,
    files: r.files.map((f) => ({
      path: f.path,
      size: f.size,
      sha256: f.sha256,
      format: f.format ?? null,
      rows: f.rows ?? null,
      schema: f.schema ?? null,
      url: url(f.path),
      modified: r.createdAt,
    })),
    readme: r.readme ? { url: url(r.readme.path), sha256: r.readme.sha256 } : null,
    recordUri: d.uri,
    recordCid: d.cid,
    record: r,
    maintainer: person(d.did, maintainer),
    instance: {
      name: instance?.record.name ?? null,
      url: d.instanceUrl,
      href: instancePath(d.did, d.instanceUrl),
    },
  };
}

export async function dataDirPage(db: D1Database, did: string, name: string) {
  const d = await getDataDir(db, did, name);
  if (!d) return null;
  const [maintainer, instances] = await Promise.all([
    getMaintainer(db, did),
    instancesFor(db, [{ did, url: d.instanceUrl }]),
  ]);
  const instance = instances.get(`${did} ${d.instanceUrl}`) ?? null;
  return {
    dataDir: dataDirModel(d, maintainer, instance),
    instanceUrl: d.instanceUrl,
  };
}

/** Data dirs as listing rows (an instance's or a maintainer's). */
function rows(items: IndexedDataDir[]) {
  return items.map((d) => ({
    name: d.record.name,
    href: dataDirPath(d),
    title: d.record.title ?? null,
    description: d.record.description ?? null,
    files: d.record.files.length,
    size: size(d),
    license: d.record.license ?? null,
    updated: d.record.createdAt,
  }));
}

export async function instancePage(db: D1Database, did: string, host: string) {
  const instance = await getInstance(db, did, host);
  if (!instance) return null;
  const [maintainer, items] = await Promise.all([
    getMaintainer(db, did),
    dataDirsBy(db, did, instance.url),
  ]);
  const dates = items.map((d) => d.record.createdAt).sort();
  return {
    instance: {
      name: instance.record.name,
      description: instance.record.description ?? null,
      url: instance.url,
      uri: instance.uri,
      createdAt: instance.record.createdAt,
    },
    operator: { ...person(did, maintainer), pds: maintainer?.pds ?? null },
    dataDirs: rows(items),
    bytes: items.reduce((sum, d) => sum + size(d), 0),
    firstPublished: dates[0] ?? null,
    lastPublished: dates.at(-1) ?? null,
  };
}

export async function maintainerPage(db: D1Database, did: string) {
  const [maintainer, instances, items] = await Promise.all([
    getMaintainer(db, did),
    instancesBy(db, did),
    dataDirsBy(db, did),
  ]);
  if (!maintainer && instances.length === 0 && items.length === 0) return null;
  return {
    person: {
      ...person(did, maintainer),
      description: maintainer?.description ?? null,
      pds: maintainer?.pds ?? null,
    },
    instances: instances.map((i) => ({
      name: i.record.name,
      description: i.record.description ?? null,
      url: i.url,
      href: instancePath(i.did, i.url),
    })),
    dataDirs: rows(items),
  };
}

export async function instancesPage(db: D1Database) {
  const directory = await instanceDirectory(db);
  const people = await getMaintainers(
    db,
    directory.map((i) => i.did),
  );
  return directory.map((i) => ({
    name: i.record.name,
    url: i.url,
    href: instancePath(i.did, i.url),
    operator: person(i.did, people.get(i.did)),
    dataDirs: i.dataDirs,
    bytes: i.bytes,
    lastPublished: i.lastPublished,
  }));
}
