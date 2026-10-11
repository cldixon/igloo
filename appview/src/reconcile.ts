import { COLLECTIONS } from "@igloo/lexicon";
import { listAllRecords, resolveDid, xrpcGet } from "@igloo/platform";
import { indexedUris } from "./db.js";
import { enqueue } from "./queue.js";

/** Every repo the relay knows to hold records in `collection`. */
async function reposWith(relay: string, collection: string): Promise<string[]> {
  const dids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await xrpcGet<{ repos: { did: string }[]; cursor?: string }>(
      relay,
      "com.atproto.sync.listReposByCollection",
      { collection, limit: 1000, cursor },
    );
    dids.push(...page.repos.map((r) => r.did));
    cursor = page.repos.length > 0 ? page.cursor : undefined;
  } while (cursor);
  return dids;
}

export type ReconcileReport = {
  repos: number;
  records: number;
  stale: number;
  failedRepos: string[];
};

/**
 * Rebuild from the network: queue every igloo record the relay knows about,
 * and every indexed record it no longer lists (the re-fetch removes those).
 * Covers Durable Object eviction, redeploys and gaps beyond Jetstream's
 * replay window; run on an empty index, it is the backfill.
 */
export async function reconcile(env: Env, db: D1Database): Promise<ReconcileReport> {
  const seen = new Set<string>();
  const failedRepos: string[] = [];
  const allRepos = new Set<string>();

  for (const collection of COLLECTIONS) {
    for (const did of await reposWith(env.RELAY_URL, collection)) {
      allRepos.add(did);
      try {
        const { pds } = await resolveDid(did, { plcDirectory: env.PLC_DIRECTORY });
        for (const record of await listAllRecords(pds, did, collection)) seen.add(record.uri);
      } catch (error) {
        console.warn(`reconcile: skipping ${did}`, error);
        failedRepos.push(did);
      }
    }
  }

  // Records in the index the network didn't list: re-fetch to confirm they're gone.
  // Skip repos we couldn't reach, so an outage doesn't empty the index.
  const indexed = [
    ...(await indexedUris(db, "data_dirs")),
    ...(await indexedUris(db, "instances")),
  ];
  const stale = indexed.filter(
    (uri) => !seen.has(uri) && !failedRepos.some((did) => uri.startsWith(`at://${did}/`)),
  );

  await enqueue(env.INDEX_QUEUE, [...seen, ...stale]);
  return { repos: allRepos.size, records: seen.size, stale: stale.length, failedRepos };
}
