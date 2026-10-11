import { NSID, instanceRkey, type DataDirRecord, type InstanceRecord } from "@igloo/lexicon";
import { xrpcProcedure, type OAuthClient } from "@igloo/platform";

/** Writes to the owner's PDS through their OAuth session. */

export type RecordRef = { uri: string; cid: string };

export class PdsError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PdsError";
  }
}

async function ownerSession(oauth: OAuthClient, did: string) {
  try {
    return await oauth.restore(did);
  } catch (error) {
    throw new PdsError("Your sign-in with your PDS has expired. Sign out and back in.", {
      cause: error,
    });
  }
}

export async function putRecord(
  oauth: OAuthClient,
  did: string,
  collection: string,
  rkey: string,
  record: DataDirRecord | InstanceRecord,
): Promise<RecordRef> {
  const session = await ownerSession(oauth, did);
  return xrpcProcedure<RecordRef>(
    (path, init) => session.fetchHandler(path, init),
    "com.atproto.repo.putRecord",
    { repo: did, collection, rkey, record },
  );
}

export async function deleteRecord(
  oauth: OAuthClient,
  did: string,
  collection: string,
  rkey: string,
): Promise<void> {
  const session = await ownerSession(oauth, did);
  await xrpcProcedure(
    (path, init) => session.fetchHandler(path, init),
    "com.atproto.repo.deleteRecord",
    { repo: did, collection, rkey },
  );
}

export function putDataDirRecord(oauth: OAuthClient, did: string, record: DataDirRecord) {
  return putRecord(oauth, did, NSID.dataDir, record.name, record);
}

export function putInstanceRecord(oauth: OAuthClient, did: string, record: InstanceRecord) {
  return putRecord(oauth, did, NSID.instance, instanceRkey(record.url), record);
}

/**
 * Tell the AppView a record changed, so the feed updates within seconds.
 * Only a hint: the AppView re-fetches the record from the PDS, and Jetstream
 * would deliver the change anyway, so failures are logged and ignored.
 */
export async function notifyAppView(appviewUrl: string, uri: string): Promise<void> {
  try {
    const res = await fetch(new URL(`/xrpc/${NSID.notifyRecord}`, appviewUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uri }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.warn(`AppView notify for ${uri} returned ${res.status}`);
  } catch (error) {
    console.warn(`AppView notify for ${uri} failed`, error);
  }
}
