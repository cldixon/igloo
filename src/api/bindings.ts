/// <reference types="@cloudflare/workers-types" />

/** Bindings and vars declared in wrangler.jsonc. */
export type Bindings = {
  DATA: R2Bucket;
  ASSETS: Fetcher;
  IGLOO_TITLE: string;
  IGLOO_TAGLINE: string;
  IGLOO_THEME: string;
};
