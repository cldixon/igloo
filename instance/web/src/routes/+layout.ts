import { fetchConfig } from "$lib/api";
import { auth } from "$lib/admin";
import type { LayoutLoad } from "./$types";

// A client-rendered SPA, served by Workers Static Assets.
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ fetch, depends }) => {
  depends("igloo:session");
  const [config, status] = await Promise.all([
    fetchConfig(fetch),
    auth.status(fetch).catch(() => null),
  ]);
  return { config, status };
};
