#!/usr/bin/env bun
/**
 * Runs the two halves of local development:
 *   - `wrangler dev` on :8787 — the Worker, holding the real R2 binding
 *   - `vite dev` on :5173     — the SPA with HMR, proxying /api to the Worker
 *
 * Defaults to --remote so you browse the actual bucket. Pass --local to use
 * wrangler's simulated R2 (empty unless you seed it).
 */
import { spawn } from "child_process";

const local = process.argv.includes("--local");

const wranglerArgs = ["wrangler", "dev", "--port", "8787"];
if (!local) wranglerArgs.push("--remote");

console.log(`igloo dev — Worker on :8787 (${local ? "local" : "remote"} R2), UI on :5173`);

const worker = spawn("bunx", wranglerArgs, { stdio: "inherit" });
const web = spawn("bun", ["--bun", "vite", "dev"], {
  stdio: "inherit",
  cwd: "web",
});

function cleanup() {
  worker.kill();
  web.kill();
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

for (const [name, proc] of [
  ["worker", worker],
  ["web", web],
] as const) {
  proc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      cleanup();
    }
  });
}
