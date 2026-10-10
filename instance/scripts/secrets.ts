#!/usr/bin/env bun
/**
 * Set the instance's secrets on the deployed Worker (run after the first
 * `bun run deploy`):
 *
 *   SETUP_CODE         the one-time code the first sign-in must enter to claim
 *                      the instance
 *   OAUTH_SIGNING_KEY  the ES256 key the instance signs OAuth client
 *                      assertions with
 *
 * Both are optional: without them the instance generates its own on first use,
 * keeps them in D1, and writes the setup code to the Worker's logs. Setting
 * them as secrets keeps them out of the database.
 */
import { $ } from "bun";
import { join } from "path";
import { generateSigningJwk, generateToken } from "@igloo/platform";
import { loadIglooConfig } from "../config.ts";

const { worker } = loadIglooConfig(join(import.meta.dirname, ".."));

const setupCode = generateToken(12);
const signingKey = await generateSigningJwk();

for (const [name, value] of [
  ["SETUP_CODE", setupCode],
  ["OAUTH_SIGNING_KEY", signingKey],
] as const) {
  await $`bunx cf workers secrets update ${name} --worker ${worker} --type secret_text --text ${value}`.quiet();
  console.log(`✓ ${name} set on ${worker}`);
}

console.log(`\nSetup code: ${setupCode}`);
console.log("Open /admin on your instance and sign in with it to claim the instance.\n");
