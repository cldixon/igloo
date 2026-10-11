import { NSID } from "@igloo/lexicon";
import { oauthClientFor, type OAuthClient } from "@igloo/platform";

/**
 * What the instance asks the owner's PDS for: write access to igloo records
 * only. Nothing else in the account.
 */
export const OAUTH_SCOPE = `atproto repo:${NSID.dataDir} repo:${NSID.instance}`;

/** The OAuth client for this instance at `origin`. */
export function getOAuthClient(
  db: D1Database,
  origin: string,
  { title, signingKeySecret }: { title: string; signingKeySecret: string | undefined },
): Promise<OAuthClient> {
  return oauthClientFor(db, origin, {
    scope: OAUTH_SCOPE,
    clientName: title,
    signingKeySecret,
  });
}
