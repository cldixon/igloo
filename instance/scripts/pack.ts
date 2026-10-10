#!/usr/bin/env bun
/**
 * Build the publishable @igloo-data/instance package into dist/package and
 * pack it into dist/. It holds the prebuilt Worker bundle, the built web UI,
 * the defineIgloo config helper and the igloo CLI, so owners deploy without
 * building igloo's source.
 */
import { $ } from "bun";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..");
const out = join(root, "dist", "package");
const own = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The web UI, then the Worker bundle. The bundle doesn't depend on any owner's
// settings, so the example config stands in for one.
await $`bun run build`.cwd(root);
await $`bunx cf build`.cwd(root).env({ ...process.env, IGLOO_CONFIG: "igloo.config.example.json" });
const built = join(root, ".cloudflare", "output", "v0", "workers", "default");
cpSync(join(built, "bundle"), join(out, "worker"), { recursive: true });
cpSync(join(root, "web", "build"), join(out, "web"), { recursive: true });

// The config helper and the CLI. cf and wrangler come from the owner's folder.
const external = ["cf", "cf/*", "wrangler", "wrangler/*"];
for (const [entry, target] of [
  ["config.ts", "node"],
  ["cli/igloo.ts", "bun"],
] as const) {
  const result = await Bun.build({
    entrypoints: [join(root, entry)],
    outdir: out,
    target,
    format: "esm",
    external,
    naming: entry === "config.ts" ? "config.js" : "cli.js",
  });
  if (!result.success) throw new AggregateError(result.logs, `Couldn't bundle ${entry}`);
}
cpSync(join(root, "package"), out, { recursive: true });

const cf = own.devDependencies.cf;
const wrangler = own.devDependencies.wrangler;
writeFileSync(
  join(out, "package.json"),
  JSON.stringify(
    {
      name: "@igloo-data/instance",
      version: own.version,
      description:
        "An igloo instance: a self-hosted data space on Cloudflare, joined by AT Protocol",
      type: "module",
      license: "MIT",
      repository: {
        type: "git",
        url: "git+https://github.com/cldixon/igloo.git",
        directory: "instance",
      },
      bin: { igloo: "cli.js" },
      exports: {
        "./config": { types: "./config.d.ts", default: "./config.js" },
        "./wrangler": "./wrangler.js",
      },
      files: ["cli.js", "config.js", "config.d.ts", "wrangler.js", "worker", "web", "README.md"],
      peerDependencies: { cf, wrangler },
      engines: { bun: ">=1.2.0" },
    },
    null,
    2,
  ) + "\n",
);

await $`npm pack --pack-destination ${join(root, "dist")}`.cwd(out).quiet();
console.log(`✓ Packed @igloo-data/instance@${own.version} into dist/`);

// create-igloo, released in step with the instance, so `bun create igloo`
// always installs the matching version.
const create = join(root, "dist", "create-igloo");
mkdirSync(create, { recursive: true });
const scaffold = await Bun.build({
  entrypoints: [join(root, "..", "packages", "create-igloo", "src", "index.ts")],
  outdir: create,
  target: "bun",
  format: "esm",
  naming: "index.js",
  define: {
    IGLOO_VERSION: JSON.stringify(own.version),
    CF_VERSION: JSON.stringify(cf),
    WRANGLER_VERSION: JSON.stringify(wrangler),
  },
});
if (!scaffold.success) throw new AggregateError(scaffold.logs, "Couldn't bundle create-igloo");
writeFileSync(
  join(create, "README.md"),
  "# create-igloo\n\nCreate your own [igloo](https://github.com/cldixon/igloo) instance:\n\n```bash\nbun create igloo my-igloo\n```\n",
);
writeFileSync(
  join(create, "package.json"),
  JSON.stringify(
    {
      name: "create-igloo",
      version: own.version,
      description:
        "Create your own igloo instance: a self-hosted data space on Cloudflare, joined by AT Protocol",
      type: "module",
      license: "MIT",
      repository: {
        type: "git",
        url: "git+https://github.com/cldixon/igloo.git",
        directory: "packages/create-igloo",
      },
      bin: { "create-igloo": "index.js" },
      files: ["index.js", "README.md"],
      engines: { bun: ">=1.2.0" },
    },
    null,
    2,
  ) + "\n",
);
await $`npm pack --pack-destination ${join(root, "dist")}`.cwd(create).quiet();
console.log(`✓ Packed create-igloo@${own.version} into dist/`);
