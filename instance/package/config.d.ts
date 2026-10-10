/** An igloo instance's settings, as igloo.config.json holds them. */
export type IglooConfig = {
  worker: string;
  bucket: string;
  database?: string;
  domain?: string | null;
  title?: string;
  tagline?: string;
  theme?: string;
  appview?: string;
};

/**
 * The instance Worker's cf config, from the igloo.config.json in `dir`.
 * Use as the default export of cloudflare.config.ts:
 *
 *   export default defineIgloo({ dir: import.meta.dirname });
 */
export function defineIgloo(options: { dir: string; entrypoint?: string }): unknown;

export function loadIglooConfig(dir: string, options?: { allowDefaults?: boolean }): IglooConfig;
