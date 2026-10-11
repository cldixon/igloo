#!/usr/bin/env bun
/**
 * `bun create igloo [folder]`: make a folder that deploys an igloo instance.
 *
 * The folder holds the owner's settings (igloo.config.json) and depends on
 * @igloo-data/instance, which ships the prebuilt Worker and the igloo CLI. It
 * is meant to be its own git repo: commit it, and updating igloo is bumping
 * that dependency.
 *
 *   --from <spec>   install @igloo-data/instance from <spec> instead of npm
 *                   (a version, a tarball path or URL)
 *   --no-deploy     stop after setup
 */
import { $ } from "bun";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";

declare const IGLOO_VERSION: string;
declare const CF_VERSION: string;
declare const WRANGLER_VERSION: string;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const from = flag("--from");
const noDeploy = args.includes("--no-deploy");
const folder = args.find((a) => !a.startsWith("--")) ?? "my-igloo";
const dir = resolve(folder);

if (existsSync(dir) && readdirSync(dir).length > 0) {
  console.error(`${folder} already exists and isn't empty.`);
  process.exit(1);
}

console.log(`\n❄  Creating an igloo instance in ${folder}\n`);
mkdirSync(dir, { recursive: true });

const files: Record<string, string> = {
  "package.json":
    JSON.stringify(
      {
        name: folder.split("/").pop(),
        private: true,
        type: "module",
        scripts: {
          setup: "igloo setup",
          deploy: "igloo deploy",
          dev: "igloo dev",
          secrets: "igloo secrets",
        },
        dependencies: {
          "@igloo-data/instance": from ? resolveSpec(from) : `^${IGLOO_VERSION}`,
          cf: CF_VERSION,
          wrangler: WRANGLER_VERSION,
        },
      },
      null,
      2,
    ) + "\n",
  "cloudflare.config.ts": `import { defineIgloo } from "@igloo-data/instance/config";

// Your settings are in igloo.config.json (\`bun run setup\` writes it).
export default defineIgloo({ dir: import.meta.dirname });
`,
  "wrangler.config.ts": `export { default } from "@igloo-data/instance/wrangler";\n`,
  ".github/workflows/deploy.yml": `name: Deploy

# Deploys this igloo instance on every push to main, using the repo secret
# CLOUDFLARE_API_TOKEN. Without the secret, it skips with a notice.
on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
    steps:
      - name: No token, no deploy
        if: env.CLOUDFLARE_API_TOKEN == ''
        run: echo "::notice::Not deploying. Add the CLOUDFLARE_API_TOKEN repo secret to deploy on push."
      - uses: actions/checkout@v4
        if: env.CLOUDFLARE_API_TOKEN != ''
      - uses: oven-sh/setup-bun@v2
        if: env.CLOUDFLARE_API_TOKEN != ''
      - run: bun install --frozen-lockfile
        if: env.CLOUDFLARE_API_TOKEN != ''
      - run: bun run deploy
        if: env.CLOUDFLARE_API_TOKEN != ''
`,
  ".gitignore": "node_modules/\n.cloudflare/\n.wrangler/\n",
  "README.md": `# My igloo

An [igloo](https://github.com/cldixon/igloo) instance. Its settings are in \`igloo.config.json\`; the code comes from [\`@igloo-data/instance\`](https://www.npmjs.com/package/@igloo-data/instance).

| Command           | What it does                                                                  |
| ----------------- | ----------------------------------------------------------------------------- |
| \`bun run setup\`   | Change the settings (re-run any time)                                         |
| \`bun run deploy\`  | Deploy. The first deploy prints the setup code that claims the instance       |
| \`bun run dev\`     | Run it locally on http://127.0.0.1:8787 (\`bun run dev -- --local\`: fake bucket) |

**Update igloo:** \`bun update @igloo-data/instance && bun run deploy\`. Migrations apply themselves.

**Deploy on push (optional):** \`.github/workflows/deploy.yml\` deploys every push to \`main\` once this repo has the secret \`CLOUDFLARE_API_TOKEN\` (a Cloudflare API token from the "Edit Cloudflare Workers" template, plus D1 Edit). Until then it skips, and \`bun run deploy\` from your machine is all you need. To add it: \`gh secret set CLOUDFLARE_API_TOKEN\`, or the repo's Settings, then Secrets and variables, then Actions.
`,
};
for (const [name, content] of Object.entries(files)) {
  mkdirSync(dirname(join(dir, name)), { recursive: true });
  writeFileSync(join(dir, name), content);
}
console.log("✓ Wrote the instance folder");

await $`bun install`.cwd(dir).quiet();
console.log("✓ Installed @igloo-data/instance");

if ((await $`git --version`.nothrow().quiet()).exitCode === 0) {
  await $`git init -q`.cwd(dir).nothrow();
}

const whoami = await $`bunx cf auth whoami`.cwd(dir).nothrow().quiet();
let signedIn = false;
try {
  signedIn = whoami.exitCode === 0 && JSON.parse(whoami.stdout.toString()).authenticated;
} catch {
  // Unparseable output means cf could not report a session.
}
if (!signedIn) {
  console.log("\nSign in to Cloudflare (a browser window opens):");
  await interactive(["bunx", "cf", "auth", "login"]);
}

await interactive(["bunx", "igloo", "setup"]);

const answer = noDeploy ? null : prompt("Deploy it now? [Y/n]");
if (answer !== null && answer.trim().toLowerCase() !== "n") {
  await interactive(["bunx", "igloo", "deploy"]);
}

console.log(
  `Done. Your instance lives in ${folder}: commit it, and deploy with \`bun run deploy\`.\n`,
);

/** Run a command in the new folder with this terminal, so it can prompt. */
async function interactive(cmd: string[]) {
  const code = await Bun.spawn(cmd, { cwd: dir, stdio: ["inherit", "inherit", "inherit"] }).exited;
  if (code !== 0) process.exit(code);
}

/** A local tarball path becomes absolute, so the new folder can install it. */
function resolveSpec(spec: string): string {
  return /^(\.|\/).*\.tgz$/.test(spec) ? resolve(spec) : spec;
}
