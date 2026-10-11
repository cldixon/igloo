import { instancesPage } from "$server/pages.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => ({
  instances: await instancesPage(locals.db),
});
