import { NSID, instanceRkey, parseAtUri, validateDataDir, validateInstance } from "@igloo/lexicon";
import { getBskyProfile, getRecord, resolveDid, type XrpcOptions } from "@igloo/platform";
import { deleteRecord, upsertDataDir, upsertInstance, upsertMaintainer } from "./db.js";

export type IndexOutcome = "indexed" | "deleted" | "invalid" | "ignored";

export type IndexOptions = XrpcOptions & {
  plcDirectory?: string;
  bskyAppview?: string;
};

/**
 * Bring one record's entry in the index up to date with its author's PDS.
 *
 * Jetstream events and notify calls only say "look at this URI": Jetstream
 * strips signatures and notify calls can come from anyone, so the record is
 * always fetched from the repo's own PDS before it is indexed. A record that
 * is gone, or no longer valid, is removed from the index.
 *
 * Throws on transient failures (PDS or directory unreachable), so the queue
 * retries.
 */
export async function indexRecord(
  db: D1Database,
  uri: string,
  options: IndexOptions = {},
): Promise<IndexOutcome> {
  const parsed = parseAtUri(uri);
  if (!parsed || (parsed.collection !== NSID.dataDir && parsed.collection !== NSID.instance)) {
    return "ignored";
  }
  const { did, collection, rkey } = parsed;
  const canonical = `at://${did}/${collection}/${rkey}`;

  const identity = await resolveDid(did, { ...options, plcDirectory: options.plcDirectory });
  const found = await getRecord(identity.pds, did, collection, rkey, options);
  if (!found) {
    await deleteRecord(db, canonical);
    return "deleted";
  }
  const ref = { uri: canonical, did, rkey, cid: found.cid };

  if (collection === NSID.dataDir) {
    const result = validateDataDir(found.value);
    if (!result.ok || result.value.name !== rkey) {
      console.warn(
        `Invalid dataDir ${canonical}`,
        result.ok ? "name doesn't match rkey" : result.errors,
      );
      await deleteRecord(db, canonical);
      return "invalid";
    }
    await upsertDataDir(db, ref, result.value);
  } else {
    const result = validateInstance(found.value);
    if (!result.ok || instanceRkey(result.value.url) !== rkey) {
      console.warn(
        `Invalid instance ${canonical}`,
        result.ok ? "url doesn't match rkey" : result.errors,
      );
      await deleteRecord(db, canonical);
      return "invalid";
    }
    await upsertInstance(db, ref, result.value);
  }

  // The maintainer's name and avatar come from their Bluesky profile, if any.
  // Best effort: a missing profile never blocks indexing.
  let profile = null;
  try {
    profile = await getBskyProfile(did, { ...options, appview: options.bskyAppview });
  } catch (error) {
    console.warn(`No profile for ${did}`, error);
  }
  await upsertMaintainer(db, {
    did,
    handle: profile?.handle ?? identity.handle,
    displayName: profile?.displayName ?? null,
    avatar: profile?.avatar ?? null,
    description: profile?.description ?? null,
    pds: identity.pds,
  });
  return "indexed";
}
