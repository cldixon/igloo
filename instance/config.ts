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
  if (!file && !env.bucket && !allowDefaults) {
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
