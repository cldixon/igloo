#!/usr/bin/env bun

import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_ROOT = resolve(__dirname, "..");
const PROJECT_ROOT = process.cwd();

const command = process.argv[2];

switch (command) {
  case "dev":
    dev();
    break;
  case "build":
    build();
    break;
  case "start":
    start();
    break;
  default:
    console.log("Usage: igloo-server <dev|build|start>");
    console.log("");
    console.log("Commands:");
    console.log("  dev     Start API and web dev servers");
    console.log("  build   Build the web frontend for production");
    console.log("  start   Start the production server");
    process.exit(command ? 1 : 0);
}

function dev() {
  const apiEntry = resolve(FRAMEWORK_ROOT, "src/api/index.ts");
  const webDir = resolve(FRAMEWORK_ROOT, "web");

  const api = spawn("bun", ["--watch", apiEntry], {
    stdio: "inherit",
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: process.env.PORT ?? "3001" },
  });

  const web = spawn("bun", ["--bun", "vite", "dev"], {
    stdio: "inherit",
    cwd: webDir,
  });

  function cleanup() {
    api.kill();
    web.kill();
    process.exit();
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  api.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`API process exited with code ${code}`);
      cleanup();
    }
  });

  web.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`Web process exited with code ${code}`);
      cleanup();
    }
  });
}

function build() {
  const webDir = resolve(FRAMEWORK_ROOT, "web");

  const result = spawn("bun", ["--bun", "vite", "build"], {
    stdio: "inherit",
    cwd: webDir,
    env: { ...process.env, VITE_API_URL: "" },
  });

  result.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

async function start() {
  const serverEntry = resolve(FRAMEWORK_ROOT, "src/server.ts");
  await import(serverEntry);
}
