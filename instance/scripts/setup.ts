#!/usr/bin/env bun
/**
 * One-shot provisioning for a new igloo instance.
 *
 * Creates the R2 bucket if it does not exist, sets its CORS rules, and writes
 * your instance's settings to igloo.config.json (gitignored). The D1 database
 * is created by the first deploy. Run once after cloning, then `bun run deploy`.
 * Safe to re-run: your current answers are the defaults.
 */
import { $ } from "bun";
import { writeFileSync } from "fs";
import { basename, join } from "path";
import { configPath, DEFAULTS, readConfigFile, type IglooConfig } from "../config.ts";

const root = join(import.meta.dirname, "..");
const file = configPath(root);
// Setup may create the file IGLOO_CONFIG names; everything else requires it.
process.env.IGLOO_SETUP = "1";
// Re-running setup offers the current answers as the defaults.
const current: Partial<IglooConfig> = readConfigFile(root) ?? {};

function ask(question: string, fallback: string): string {
  const answer = prompt(`${question} [${fallback}]:`);
  return answer?.trim() || fallback;
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

const worker = ask("Worker name", current.worker ?? DEFAULTS.worker);
const bucket = ask("R2 bucket name", current.bucket ?? DEFAULTS.bucket);
const title = ask("Site title", current.title ?? DEFAULTS.title);
const tagline = ask("Site tagline", current.tagline ?? DEFAULTS.tagline);
const domainAnswer = prompt(
  `Custom domain, on a zone in your Cloudflare account (blank for none, "-" to remove) [${current.domain ?? ""}]:`,
)?.trim();
const domain = domainAnswer === "-" ? "" : domainAnswer || current.domain || "";

// Creating a bucket that already exists is an error, so check the list first.
const listing = await $`bunx cf r2 buckets list --name-contains ${bucket}`.json();
const exists = (listing.buckets ?? []).some((b: { name: string }) => b.name === bucket);
if (exists) {
  console.log(`\n✓ R2 bucket "${bucket}" already exists`);
} else {
  console.log(`\n→ Creating R2 bucket "${bucket}"...`);
  await $`bunx cf r2 buckets create --name ${bucket}`.quiet();
}

// Browsers (the AppView's README check now; DuckDB in phase 2) read files with
// range requests, so the bucket allows cross-origin GET/HEAD with Range.
const CORS_RULES = [
  {
    allowed: { origins: ["*"], methods: ["GET", "HEAD"], headers: ["Range"] },
    exposeHeaders: ["Content-Range", "Content-Length", "ETag"],
    maxAgeSeconds: 3600,
  },
];
await $`bunx cf r2 buckets cors update ${bucket} --force --rules ${JSON.stringify(CORS_RULES)}`.quiet();
console.log(`✓ CORS set on "${bucket}"`);

// One database per instance, named after the Worker, so several instances can
// share a Cloudflare account. cf deploy creates it on first deploy.
const config: IglooConfig = { ...current, worker, bucket, title, tagline, domain: domain || null };
writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

console.log(`✓ Wrote ${basename(file)} (keep it: deploys read it, and git ignores it)`);
console.log(
  domain
    ? `✓ Routing ${domain} to this Worker (the zone must be on your account)\n`
    : `✓ No custom domain — your igloo will be served from *.workers.dev\n`,
);
console.log("Next steps:");
console.log("  bun run dev      # browse locally at http://localhost:5173");
console.log("  bun run deploy   # build the UI and deploy the Worker");
console.log("  bun run secrets  # then: set the setup code and OAuth key as secrets\n");
