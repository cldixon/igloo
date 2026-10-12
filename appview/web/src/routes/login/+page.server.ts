import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const ERRORS: Record<string, string> = {
  authorize: "Couldn't start sign-in for that handle. Check it and try again.",
  callback: "Sign-in didn't complete. Try again.",
};

/** The sign-in form; it posts to /login, which the API half of the Worker handles. */
export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.viewer) redirect(303, "/");
  const error = url.searchParams.get("error");
  return {
    handle: url.searchParams.get("handle") ?? "",
    error: error ? (ERRORS[error] ?? "Sign-in failed.") : null,
  };
};
