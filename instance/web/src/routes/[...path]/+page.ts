import { error } from "@sveltejs/kit";
import { NotFound, fetchDataDir } from "$lib/api";
import type { PageLoad } from "./$types";

/**
 * /<data dir>, plus anything below it (old links into a folder land on the
 * data dir). Only published data dirs are public.
 */
export const load: PageLoad = async ({ params, fetch }) => {
  const name = params.path.split("/")[0]!;
  try {
    return { name, dataDir: await fetchDataDir(name, fetch) };
  } catch (e) {
    if (e instanceof NotFound) error(404, `No published data dir named "${name}"`);
    throw e;
  }
};
