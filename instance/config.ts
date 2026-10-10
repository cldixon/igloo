import { bindings, defineConfig } from "cf/config";
import { existsSync, readFileSync } from "fs";
import { isAbsolute, join } from "path";

/**
 * What makes one igloo instance different from another. The code is the same
 * for everyone; these settings are each owner's, so they live in a gitignored
 * igloo.config.json (written by `bun run setup`), never in the source.
 */
export type IglooConfig = {
  /** Worker name. Also names the D1 database unless `database` is set. */
  worker: string;
  /** R2 bucket that holds the data files. */
  bucket: string;
  /** D1 database for instance state. Defaults to the Worker name. */
  database?: string;
  /** Custom domain on a zone in your account. Without one, workers.dev serves the instance. */
  domain?: string | null;
  title?: string;
  tagline?: string;
  theme?: string;
  /** The AppView this instance notifies and links to. */
  appview?: string;
};

export const CONFIG_FILE = "igloo.config.json";

export const DEFAULTS = {
  worker: "igloo",
  bucket: "igloo-data",
  title: "igloo",
  tagline: "personal data repository",
  theme: "repo",
  appview: "https://igloo.cldixon.dev",
} as const;

/** Environment variables that override the file, for CI and Workers Builds. */
const ENV: Record<keyof IglooConfig, string> = {
  worker: "IGLOO_WORKER",
  bucket: "IGLOO_BUCKET",
  database: "IGLOO_DATABASE",
  domain: "IGLOO_DOMAIN",
  title: "IGLOO_TITLE",
  tagline: "IGLOO_TAGLINE",
  theme: "IGLOO_THEME",
  appview: "IGLOO_APPVIEW_URL",
};

/** The config file's path: igloo.config.json, or the file `IGLOO_CONFIG` names. */
export function configPath(dir: string): string {
  const named = process.env.IGLOO_CONFIG;
  return named ? (isAbsolute(named) ? named : join(dir, named)) : join(dir, CONFIG_FILE);
}

/** Read the config file, or null if there isn't one. */
export function readConfigFile(dir: string): Partial<IglooConfig> | null {
  const named = process.env.IGLOO_CONFIG;
  const path = configPath(dir);
  if (!existsSync(path)) {
    if (named && !process.env.IGLOO_SETUP) {
      throw new Error(`IGLOO_CONFIG points at ${path}, which doesn't exist`);
    }
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8")) as Partial<IglooConfig>;
}

/**
 * The instance's settings: the config file, then environment overrides.
 *
 * Without either, this throws unless `allowDefaults` is set (local dev and
 * type generation). A deploy that silently fell back to defaults would bind a
 * different bucket and drop the custom domain from a running instance.
 */
export function loadIglooConfig(dir: string, { allowDefaults = false } = {}): IglooConfig {
  const file = readConfigFile(dir);
  const env: Partial<IglooConfig> = {};
  for (const [key, name] of Object.entries(ENV) as [keyof IglooConfig, string][]) {
    const value = process.env[name];
    if (value !== undefined) (env as Record<string, string | null>)[key] = value || null;
  }
  // `igloo setup` runs cf commands before the file exists, and cf evaluates
  // this config for every command run in the folder.
  if (!file && !env.bucket && !allowDefaults && !process.env.IGLOO_SETUP) {
    throw new Error(
      `No ${CONFIG_FILE} in ${dir}. Run \`bun run setup\` to create one, ` +
        `or set IGLOO_BUCKET (and IGLOO_DOMAIN, IGLOO_WORKER) in the environment.`,
    );
  }
  const config = { ...DEFAULTS, ...file, ...env } as IglooConfig;
  if (!config.worker || !config.bucket)
    throw new Error(`${CONFIG_FILE} needs a worker and a bucket`);
  return config;
}

/**
 * The instance Worker's cf config, built from the owner's settings in `dir`.
 * The repo's own instance passes its source entrypoint; the published package
 * defaults to the prebuilt bundle it ships.
 *
 * `--mode local` (`dev --local`) swaps the real bucket for a simulated one and
 * needs no config file.
 */
export function defineIgloo({ dir, entrypoint }: { dir: string; entrypoint?: string }) {
  return defineConfig(({ mode }) => {
    const local = mode === "local";
    const igloo = loadIglooConfig(dir, {
      allowDefaults: local || process.argv.includes("types"),
    });
    const domain = igloo.domain || null;

    return {
      worker: {
        name: igloo.worker,
        compatibilityDate: "2026-09-08",
        // nodejs_compat is required by the MCP SDK's streamable-HTTP transport,
        // which is shimmed onto node:stream via fetch-to-node.
        compatibilityFlags: ["nodejs_compat"],
        entrypoint: entrypoint ?? join(import.meta.dirname, "worker", "worker.js"),
        observability: { enabled: true },

        // The zone must be on your own Cloudflare account. Without a domain,
        // workers.dev is the only route the Worker has, so it is turned on.
        ...(domain && { domains: [domain] }),
        workersDev: !domain,

        // Preview versions share production's bindings, and migrations apply
        // themselves on first request, so a preview of a branch with a new
        // migration would change the real database before it merged. Test
        // locally with `dev --local` instead.
        previewUrls: false,

        // The SvelteKit SPA (directory set in wrangler.config.ts). Navigation
        // requests that do not match a built asset fall through to index.html;
        // runWorkerFirst claims the API paths so they reach the Worker instead.
        assets: {
          notFoundHandling: "single-page-application",
          runWorkerFirst: ["/api/*", "/health", "/mcp", "/mcp/*", "/oauth/*"],
        },

        env: {
          DATA: bindings.r2({ name: igloo.bucket, dev: { remote: !local } }),
          // Instance state: data dirs, file hashes, publish status, settings.
          // The schema migrates itself on first use. Always a local database
          // in dev, so development never writes to the real one. cf deploy
          // creates it.
          DB: bindings.d1({ name: igloo.database ?? igloo.worker }),
          ASSETS: bindings.assets(),
          IGLOO_TITLE: bindings.text(igloo.title ?? "igloo"),
          IGLOO_TAGLINE: bindings.text(igloo.tagline ?? ""),
          IGLOO_THEME: bindings.text(igloo.theme ?? "repo"),
          IGLOO_APPVIEW_URL: bindings.text(igloo.appview ?? ""),
          // Workers AI drafts READMEs and tags for the owner to review. It
          // always runs remotely, so local mode leaves it out.
          ...(!local && { AI: bindings.ai() }),
        },
      },
    };
  });
}
