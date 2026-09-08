#!/usr/bin/env bun
/**
 * One-shot provisioning for a new igloo instance.
 *
 * Creates the R2 bucket if it does not exist and writes your instance details
 * into wrangler.jsonc. Run once after cloning, then `bun run deploy`.
 */
import { $ } from "bun";
import { readFileSync, writeFileSync } from "fs";

const CONFIG = "wrangler.jsonc";

function ask(question: string, fallback: string): string {
  const answer = prompt(`${question} [${fallback}]:`);
  return answer?.trim() || fallback;
}

/** Replace a "key": "value" pair in the JSONC without disturbing comments. */
function setString(source: string, key: string, value: string): string {
  const pattern = new RegExp(`("${key}"\\s*:\\s*)"[^"]*"`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find "${key}" in ${CONFIG}`);
  }
  return source.replace(pattern, `$1"${value}"`);
}

console.log("\n❄  igloo setup\n");

try {
  await $`bunx wrangler whoami`.quiet();
} catch {
  console.error("Not authenticated with Cloudflare. Run: bunx wrangler login");
  process.exit(1);
}

const name = ask("Worker name", "igloo");
const bucket = ask("R2 bucket name", "data-repo");
const title = ask("Site title", "igloo");
const tagline = ask("Site tagline", "personal data repository");

// Creating a bucket that already exists is an error, so check the list first.
const existing = await $`bunx wrangler r2 bucket list`.text();
if (existing.includes(bucket)) {
  console.log(`\n✓ R2 bucket "${bucket}" already exists`);
} else {
  console.log(`\n→ Creating R2 bucket "${bucket}"...`);
  await $`bunx wrangler r2 bucket create ${bucket}`;
}

let config = readFileSync(CONFIG, "utf-8");
config = setString(config, "name", name);
config = setString(config, "bucket_name", bucket);
config = setString(config, "IGLOO_TITLE", title);
config = setString(config, "IGLOO_TAGLINE", tagline);
writeFileSync(CONFIG, config);

console.log(`✓ Wrote ${CONFIG}\n`);
console.log("Next steps:");
console.log("  bun run dev      # browse locally at http://localhost:5173");
console.log("  bun run deploy   # build the UI and deploy the Worker\n");
console.log("To serve from your own domain, add a route to wrangler.jsonc:");
console.log('  "routes": [{ "pattern": "data.example.com", "custom_domain": true }]\n');
