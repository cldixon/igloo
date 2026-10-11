import { generateToken } from "@igloo/platform";
import { getSetting, initSetting } from "@igloo/platform";

/**
 * Ownership of the instance.
 *
 * A fresh instance has no owner. The first sign-in must present the setup
 * code; that account's DID becomes the owner, and the code stops working.
 * After that only the owner can sign in.
 */

export const OWNER_DID = "owner_did";
const SETUP_CODE = "setup_code";

export async function getOwner(db: D1Database): Promise<string | null> {
  return getSetting(db, OWNER_DID);
}

/**
 * The setup code: the SETUP_CODE secret when set, otherwise one generated on
 * first use and written to the Worker's logs (visible only in the owner's
 * Cloudflare account).
 */
export async function getSetupCode(db: D1Database, secret: string | undefined): Promise<string> {
  if (secret) return secret;
  const generated = generateToken(12);
  const code = await initSetting(db, SETUP_CODE, generated);
  return code;
}

export async function logSetupCodeIfUnclaimed(
  db: D1Database,
  secret: string | undefined,
): Promise<void> {
  if (secret || (await getOwner(db))) return;
  const code = await getSetupCode(db, secret);
  console.log(`igloo: this instance is unclaimed. Setup code: ${code}`);
}

/** Constant-time comparison, so the code can't be guessed a character at a time. */
export async function checkSetupCode(
  db: D1Database,
  secret: string | undefined,
  attempt: string,
): Promise<boolean> {
  const expected = new TextEncoder().encode(await getSetupCode(db, secret));
  const given = new TextEncoder().encode(attempt.trim());
  if (expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i]! ^ given[i]!;
  return diff === 0;
}

/**
 * Make `did` the owner if there is none yet. Returns the owner afterwards,
 * which is someone else if another claim won a race.
 */
export async function claimOwnership(db: D1Database, did: string): Promise<string> {
  return initSetting(db, OWNER_DID, did);
}
