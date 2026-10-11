import { redirect } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";

/** Every admin page but the sign-in page itself needs the owner signed in. */
export const load: LayoutLoad = async ({ parent, url }) => {
  const { status } = await parent();
  if (url.pathname !== "/admin" && !status?.signedIn) redirect(307, "/admin");
};
