import type { PageLoad } from "./$types";
import { fetchListing } from "$lib/api";

export const ssr = false;

export const load: PageLoad = async ({ params }) => {
  const path = params.path ? params.path + "/" : "";
  const listing = await fetchListing(path);
  return { listing, currentPath: path };
};
