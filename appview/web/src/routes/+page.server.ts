import { homePage } from "$server/pages.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) =>
  homePage(locals.db, url.searchParams.get("before"), locals.viewer?.did);
