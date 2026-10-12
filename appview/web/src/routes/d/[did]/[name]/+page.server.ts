import { error } from "@sveltejs/kit";
import { dataDirPage } from "$server/pages.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const page = await dataDirPage(locals.db, params.did, params.name);
  if (!page) error(404, "This data dir isn't in the index. It may have been unpublished.");
  return page;
};
