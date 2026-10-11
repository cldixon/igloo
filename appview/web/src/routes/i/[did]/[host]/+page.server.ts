import { error } from "@sveltejs/kit";
import { instancePage } from "$server/pages.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const page = await instancePage(locals.db, params.did, params.host);
  if (!page) error(404, "This instance isn't in the index.");
  return page;
};
