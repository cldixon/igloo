import { error } from "@sveltejs/kit";
import { maintainerPage } from "$server/pages.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const page = await maintainerPage(locals.db, params.did);
  if (!page) error(404, "This person hasn't published anything the index knows about.");
  return page;
};
