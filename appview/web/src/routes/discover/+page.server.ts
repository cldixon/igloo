import { discoverPage } from "$server/pages.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => discoverPage(locals.db);
