#!/usr/bin/env bun
/**
 * Runs the two halves of local development:
 *   - `cf dev` on :8787   — the Worker, holding the real R2 binding
 *   - `vite dev` on :5173 — the SPA with HMR, proxying /api to the Worker
 *
 * Defaults to the real bucket. Pass --local to evaluate cloudflare.config.ts in
 * mode "local", which uses a simulated R2 (empty unless you seed it).
 */
import { spawn } from "child_process";

const local = process.argv.includes("--local");

const cfArgs = ["cf", "dev", "--port", "8787"];
if (local) cfArgs.push("--mode", "local");

console.log(`igloo dev — Worker on :8787 (${local ? "local" : "remote"} R2), UI on :5173`);

const worker = spawn("bunx", cfArgs, { stdio: "inherit" });
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
