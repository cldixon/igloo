#!/usr/bin/env bun
/**
 * One-shot provisioning for a new igloo instance.
 *
 * Creates the R2 bucket if it does not exist and writes your instance details
 * into cloudflare.config.ts. The D1 database is created by the first deploy. Run once after cloning, then `bun run deploy`.
 */
import { $ } from "bun";
import { readFileSync, writeFileSync } from "fs";

const CONFIG = "cloudflare.config.ts";

function ask(question: string, fallback: string): string {
  const answer = prompt(`${question} [${fallback}]:`);
  return answer?.trim() || fallback;
}

/** Replace the quoted string captured after `prefix` without disturbing the rest of the file. */
function setString(source: string, prefix: RegExp, value: string, label: string): string {
  // The value is a JSON-style string literal, which may hold escaped quotes.
  const pattern = new RegExp(`(${prefix.source})"(?:[^"\\\\]|\\\\.)*"`, prefix.flags);
  if (!pattern.test(source)) {
    throw new Error(`Could not find ${label} in ${CONFIG}`);
  }
  // A replacer function, so a "$" in the value is not read as a backreference.
  return source.replace(pattern, (_, head: string) => head + JSON.stringify(value));
}

/** Replace a `key: true|false` pair. */
function setBool(source: string, key: string, value: boolean): string {
  const pattern = new RegExp(`(\\b${key}:\\s*)(?:true|false)`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find ${key} in ${CONFIG}`);
  }
  return source.replace(pattern, `$1${value}`);
}

/**
 * Point the instance at a custom domain, or drop the domain entirely.
 *
 * The committed config carries the maintainer's own hostname. Deploying that
 * from a fork fails, because the zone lives on someone else's Cloudflare
 * account — so a blank answer removes the line rather than leaving a
 * confusing DNS error for the next person.
 */
function setDomains(source: string, domain: string | null): string {
  const line = /^[ \t]*domains:\s*\[.*\],?[ \t]*\r?\n/m;
  // Removing the domain should take its explanatory comment and the blank line
  // after it, so the config does not keep instructions for a line it no longer has.
  const block = /(?:^[ \t]*\/\/.*\r?\n)*^[ \t]*domains:\s*\[.*\],?[ \t]*\r?\n\r?\n?/m;

  if (!domain) {
    return source.replace(block, "");
  }

  const replacement = `    domains: [${JSON.stringify(domain)}],\n`;
  if (line.test(source)) {
    return source.replace(line, () => replacement);
  }
  // No domain configured yet — add one just after the entry point.
  return source.replace(
    /^([ \t]*entrypoint:.*\r?\n)/m,
    (head: string) => `${head}\n${replacement}`,
  );
}

console.log("\n❄  igloo setup\n");

const whoami = await $`bunx cf auth whoami`.nothrow().quiet();
let authenticated = false;
try {
  authenticated = whoami.exitCode === 0 && JSON.parse(whoami.stdout.toString()).authenticated;
} catch {
  // Unparseable output means cf could not report a session.
}
if (!authenticated) {
  console.error("Not authenticated with Cloudflare. Run: bunx cf auth login");
  process.exit(1);
}

const name = ask("Worker name", "igloo");
const bucket = ask("R2 bucket name", "data-repo");
const title = ask("Site title", "igloo");
const tagline = ask("Site tagline", "personal data repository");
const domain = ask("Custom domain (blank for none)", "").trim();

// Creating a bucket that already exists is an error, so check the list first.
const listing = await $`bunx cf r2 buckets list --name-contains ${bucket}`.json();
const exists = (listing.buckets ?? []).some((b: { name: string }) => b.name === bucket);
if (exists) {
  console.log(`\n✓ R2 bucket "${bucket}" already exists`);
} else {
  console.log(`\n→ Creating R2 bucket "${bucket}"...`);
  await $`bunx cf r2 buckets create --name ${bucket}`.quiet();
}

let config = readFileSync(CONFIG, "utf-8");
config = setString(config, /^[ \t]*name:\s*/m, name, "the Worker name");
config = setString(config, /bindings\.r2\(\{\s*name:\s*/, bucket, "the R2 bucket name");
// One database per instance, named after the Worker, so several instances can
// share a Cloudflare account. cf deploy creates it on first deploy.
config = setString(config, /bindings\.d1\(\{\s*name:\s*/, name, "the D1 database name");
config = setString(config, /IGLOO_TITLE:\s*bindings\.text\(/, title, "IGLOO_TITLE");
config = setString(config, /IGLOO_TAGLINE:\s*bindings\.text\(/, tagline, "IGLOO_TAGLINE");
config = setDomains(config, domain || null);
// Without a custom domain, workers.dev is the only route the Worker has —
// leaving it off would deploy something unreachable.
config = setBool(config, "workersDev", !domain);
writeFileSync(CONFIG, config);

console.log(`✓ Wrote ${CONFIG}`);
console.log(
  domain
    ? `✓ Routing ${domain} to this Worker (the zone must be on your account)\n`
    : `✓ No custom domain — your igloo will be served from *.workers.dev\n`,
);
console.log("Next steps:");
console.log("  bun run dev      # browse locally at http://localhost:5173");
console.log("  bun run deploy   # build the UI and deploy the Worker\n");
