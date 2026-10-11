/**
 * AT URIs and the identifiers igloo records are keyed by.
 */

/** A DID: `did:<method>:<method-specific id>`. Only plc and web are in use on the network. */
export const DID_PATTERN = /^did:(?:plc:[a-z2-7]{24}|web:[a-zA-Z0-9._:%-]+)$/;

/**
 * A data dir slug: the dataDir record key and the data dir's top-level folder
 * in R2. Lowercase, 1–64 characters, starting and ending with a letter or digit.
 * Every slug is also a valid AT Protocol record key.
 */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

export function isDid(value: string): boolean {
  return DID_PATTERN.test(value);
}

export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export type AtUri = {
  /** The repo's DID. igloo only accepts DIDs here, never handles. */
  did: string;
  collection: string;
  rkey: string;
};

/** Record keys: 1–512 characters from a restricted set, never `.` or `..`. */
const RKEY_PATTERN = /^[A-Za-z0-9._:~-]{1,512}$/;
const NSID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+\.[a-zA-Z][a-zA-Z0-9]*$/;

export function formatAtUri({ did, collection, rkey }: AtUri): string {
  return `at://${did}/${collection}/${rkey}`;
}

/** Parse a record AT URI. Returns null for anything that is not `at://<did>/<nsid>/<rkey>`. */
export function parseAtUri(uri: string): AtUri | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match) return null;
  const [, did, collection, rkey] = match as unknown as [string, string, string, string];
  if (!isDid(did) || !NSID_PATTERN.test(collection)) return null;
  if (!RKEY_PATTERN.test(rkey) || rkey === "." || rkey === "..") return null;
  return { did, collection, rkey };
}

/**
 * The instance record key: the instance's host (with port, if any), so one
 * person can run several instances.
 */
export function instanceRkey(instanceUrl: string): string {
  return new URL(instanceUrl).host;
}
