#!/usr/bin/env bun
/**
 * igloo: set up, deploy and look after one igloo instance. Runs in the folder
 * that holds its igloo.config.json (`instance/` in the igloo repo, or a deploy
 * folder made by `bun create igloo`).
 *
 *   igloo setup     ask for the settings, create the R2 bucket, set its CORS,
 *                   write igloo.config.json (safe to re-run)
 *   igloo deploy    deploy the Worker; on the very first deploy, also set the
 *                   setup code and OAuth key and print the setup code
 *   igloo secrets   set a new setup code and OAuth key (only before the
 *                   instance is claimed: a new OAuth key signs out the owner)
 *   igloo dev       run the Worker locally (`--local` for a simulated bucket)
 */
import { $ } from "bun";
import { writeFileSync } from "fs";
import { basename } from "path";
import { generateSigningJwk, generateToken } from "@igloo/platform";
import { configPath, DEFAULTS, loadIglooConfig, readConfigFile, type IglooConfig } from "../config.ts";

const root = process.cwd();
const [command, ...rest] = process.argv.slice(2);

const commands: Record<string, () => Promise<void>> = { setup, deploy, secrets, dev };
const run = command ? commands[command] : undefined;
if (!run) {
  console.log("Usage: igloo <setup|deploy|secrets|dev>");
  process.exit(command ? 1 : 0);
}
await run();

function ask(question: string, fallback: string): string {
  const answer = prompt(`${question} [${fallback}]:`);
  return answer?.trim() || fallback;
}

async function requireAuth() {
  const whoami = await $`bunx cf auth whoami`.nothrow().quiet();
  let authenticated = false;
  try {
    authenticated = whoami.exitCode === 0 && JSON.parse(whoami.stdout.toString()).authenticated;
  } catch {
    // Unparseable output means cf could not report a session.
  }
  if (!authenticated) {
    console.error("Not signed in to Cloudflare. Run: bunx cf auth login");
    process.exit(1);
  }
}

async function setup() {
  console.log("\n❄  igloo setup\n");
  // Setup may create the file IGLOO_CONFIG names, and runs cf (which evaluates
  // the config) before there is one; everything else requires it.
  process.env.IGLOO_SETUP = "1";
  $.env(process.env);
  await requireAuth();

  const file = configPath(root);
  // Re-running setup offers the current answers as the defaults.
  const current: Partial<IglooConfig> = readConfigFile(root) ?? {};

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

  // Browsers read files with range requests (the query panel's DuckDB), so the
  // bucket allows cross-origin GET/HEAD with Range.
  const CORS_RULES = [
    {
      allowed: { origins: ["*"], methods: ["GET", "HEAD"], headers: ["Range"] },
      exposeHeaders: ["Content-Range", "Content-Length", "Accept-Ranges", "ETag"],
      maxAgeSeconds: 3600,
    },
  ];
  await $`bunx cf r2 buckets cors update ${bucket} --force --rules ${JSON.stringify(CORS_RULES)}`.quiet();
  console.log(`✓ CORS set on "${bucket}"`);

  // The D1 database is named after the Worker, so several instances can share
  // a Cloudflare account. The first deploy creates it.
  const config: IglooConfig = { ...current, worker, bucket, title, tagline, domain: domain || null };
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

  console.log(`✓ Wrote ${basename(file)}`);
  console.log(
    domain
      ? `✓ Routing ${domain} to this Worker (the zone must be on your account)\n`
      : `✓ No custom domain: your igloo will be served from *.workers.dev\n`,
  );
  console.log("Next: bun run deploy\n");
}

async function hasSecrets(worker: string): Promise<boolean> {
  const listed = await $`bunx cf workers secrets list --worker ${worker}`.nothrow().quiet();
  return listed.exitCode === 0;
}

async function deploy() {
  const { worker } = loadIglooConfig(root);
  // A Worker that already exists keeps its secrets, or the keys it generated
  // in D1; replacing either would sign its owner out.
  const existed = await hasSecrets(worker);
  const code = await interactive(["bunx", "cf", "deploy", ...rest]);
  if (code !== 0) process.exit(code);
  if (!existed) await secrets();
}

async function secrets() {
  const { worker } = loadIglooConfig(root);
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
}

async function dev() {
  const local = rest.includes("--local");
  const args = ["--port", "8787", ...(local ? ["--mode", "local"] : [])];
  process.exit(await interactive(["bunx", "cf", "dev", ...args]));
}

/** Run a command with this terminal, so cf can prompt. */
function interactive(cmd: string[]): Promise<number> {
  return Bun.spawn(cmd, { cwd: root, stdio: ["inherit", "inherit", "inherit"] }).exited;
}
