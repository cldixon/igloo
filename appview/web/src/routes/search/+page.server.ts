import { searchPage, type Facets } from "$server/pages.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const p = url.searchParams;
  const size = p.get("size");
  const facets: Facets = {
    formats: p.getAll("format"),
    licenses: p.getAll("license"),
    size: size === "s" || size === "m" || size === "l" ? size : "",
  };
  const sort = p.get("sort") === "size" ? "size" : "newest";
  return { ...(await searchPage(locals.db, p.get("q") ?? "", facets, sort)), facets, sort };
};
