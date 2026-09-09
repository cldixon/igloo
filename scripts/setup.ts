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

/** Replace a "key": true|false pair in the JSONC without disturbing comments. */
function setBool(source: string, key: string, value: boolean): string {
  const pattern = new RegExp(`("${key}"\\s*:\\s*)(?:true|false)`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find "${key}" in ${CONFIG}`);
  }
  return source.replace(pattern, `$1${value}`);
}

/**
 * Point the instance at a custom domain, or drop the route entirely.
 *
 * The committed config carries the maintainer's own hostname. Deploying that
 * from a fork fails, because the zone lives on someone else's Cloudflare
 * account — so a blank answer removes the line rather than leaving a
 * confusing DNS error for the next person.
 */
function setRoutes(source: string, domain: string | null): string {
  const line = /^[ \t]*"routes"\s*:\s*\[.*\],?[ \t]*\r?\n/m;
  // Removing the route should take its explanatory comment and the blank line
  // after it, so the config does not keep instructions for a line it no longer has.
  const block =
    /(?:^[ \t]*\/\/.*\r?\n)*^[ \t]*"routes"\s*:\s*\[.*\],?[ \t]*\r?\n\r?\n?/m;

  if (!domain) {
    return source.replace(block, "");
  }

  const replacement = `  "routes": [{ "pattern": "${domain}", "custom_domain": true }],\n`;
  if (line.test(source)) {
    return source.replace(line, replacement);
  }
  // No route configured yet — add one just after the entry point.
  return source.replace(/^([ \t]*"main"\s*:.*\r?\n)/m, `$1\n${replacement}`);
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
const domain = ask("Custom domain (blank for none)", "").trim();

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
config = setRoutes(config, domain || null);
// Without a custom domain, workers.dev is the only route the Worker has —
// leaving it off would deploy something unreachable.
config = setBool(config, "workers_dev", !domain);
writeFileSync(CONFIG, config);

console.log(`✓ Wrote ${CONFIG}`);
console.log(
  domain
    ? `✓ Routing ${domain} to this Worker (the zone must be on your account)\n`
    : `✓ No custom domain — your igloo will be served from *.workers.dev\n`
);
console.log("Next steps:");
console.log("  bun run dev      # browse locally at http://localhost:5173");
console.log("  bun run deploy   # build the UI and deploy the Worker\n");
