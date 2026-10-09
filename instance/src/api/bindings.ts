/** Bindings and vars declared in cloudflare.config.ts. */
export type Bindings = {
  DATA: R2Bucket;
  DB: D1Database;
  ASSETS: Fetcher;
  IGLOO_TITLE: string;
  IGLOO_TAGLINE: string;
  IGLOO_THEME: string;
  /** Where to send notifyRecord hints after publishing. */
  IGLOO_APPVIEW_URL: string;
  /**
   * Secrets, set by `bun run setup` (cf workers secrets). Both are optional:
   * without them the instance generates its own on first use and keeps them
   * in D1, so a one-click deploy works too.
   */
  SETUP_CODE?: string;
  OAUTH_SIGNING_KEY?: string;
};
