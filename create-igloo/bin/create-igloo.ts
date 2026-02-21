#!/usr/bin/env bun

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const name = process.argv[2];

if (!name) {
  console.error("Usage: create-igloo <project-name>");
  process.exit(1);
}

const dir = resolve(process.cwd(), name);

if (existsSync(dir)) {
  console.error(`Error: directory "${name}" already exists.`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });

writeFileSync(
  resolve(dir, "package.json"),
  JSON.stringify(
    {
      name,
      private: true,
      version: "0.0.1",
      type: "module",
      scripts: {
        dev: "igloo-server dev",
        build: "igloo-server build",
        start: "igloo-server start",
      },
      dependencies: {
        "igloo-server": "^0.1.0",
      },
    },
    null,
    2
  ) + "\n"
);

writeFileSync(
  resolve(dir, "igloo.config.yaml"),
  `# igloo instance configuration
title: ${name}
tagline: personal data repository
theme: repo
`
);

writeFileSync(
  resolve(dir, ".env.example"),
  `S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET_NAME=my-bucket
PORT=3000
`
);

writeFileSync(
  resolve(dir, ".env"),
  `S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=
S3_BUCKET_NAME=
PORT=3000
`
);

writeFileSync(
  resolve(dir, ".gitignore"),
  `node_modules/
.env
.env.*
!.env.example
`
);

console.log(`\nCreated ${name}/\n`);
console.log("Next steps:");
console.log(`  cd ${name}`);
console.log("  # Edit .env with your S3-compatible storage credentials");
console.log("  bun install");
console.log("  bun run dev");
console.log("");
