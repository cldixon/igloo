import { NSID } from "@igloo/lexicon";
import {
  clientMetadata,
  createOAuthClient,
  generateSigningJwk,
  isLoopback,
  signingKeyFromJwk,
  type OAuthClient,
} from "@igloo/platform";
import { initSetting } from "./settings.js";

/**
 * What the instance asks the owner's PDS for: write access to igloo records
 * only. Nothing else in the account.
 */
export const OAUTH_SCOPE = `atproto repo:${NSID.dataDir} repo:${NSID.instance}`;

const SIGNING_KEY = "oauth_signing_jwk";

/**
 * The client's ES256 signing key: the OAUTH_SIGNING_KEY secret when set,
 * otherwise generated once and kept in D1.
 */
async function signingJwk(db: D1Database, secret: string | undefined): Promise<string> {
  if (secret) return secret;
  return initSetting(db, SIGNING_KEY, await generateSigningJwk());
}

const clients = new Map<string, Promise<OAuthClient>>();

/** The OAuth client for this instance at `origin`, cached per isolate. */
export function getOAuthClient(
  db: D1Database,
  origin: string,
  { title, signingKeySecret }: { title: string; signingKeySecret: string | undefined },
): Promise<OAuthClient> {
  let client = clients.get(origin);
  if (!client) {
    client = (async () => {
      const metadata = clientMetadata(origin, { scope: OAUTH_SCOPE, clientName: title });
      const signingKey = isLoopback(origin)
        ? undefined
        : await signingKeyFromJwk(await signingJwk(db, signingKeySecret));
      return createOAuthClient({ db, metadata, signingKey });
    })();
    client.catch(() => clients.delete(origin));
    clients.set(origin, client);
  }
  return client;
}
