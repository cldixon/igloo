import { Hono } from "hono";
import { NSID } from "@igloo/lexicon";
import { getSetting } from "@igloo/platform";
import type { Bindings } from "../bindings.js";
import type { IglooConfig, VisualTheme } from "../../shared/types.js";
import { getDb } from "../../db/migrations.js";
import { getOwner, getOwnerHandle } from "../../auth/owner.js";

export const configRoute = new Hono<{ Bindings: Bindings }>();

const VALID_THEMES: VisualTheme[] = ["repo", "index"];

const DEFAULTS: IglooConfig = {
  title: "igloo",
  tagline: "personal data repository",
  theme: "repo",
};

/** Instance config comes from text bindings in cloudflare.config.ts — there is no filesystem on Workers. */
export function loadConfig(env: Bindings): IglooConfig {
  return {
    title: env.IGLOO_TITLE || DEFAULTS.title,
    tagline: env.IGLOO_TAGLINE || DEFAULTS.tagline,
    theme: VALID_THEMES.includes(env.IGLOO_THEME as VisualTheme)
      ? (env.IGLOO_THEME as VisualTheme)
      : DEFAULTS.theme,
  };
}

/** What every page needs to frame itself: names, owner, and where the AppView is. */
configRoute.get("/config", async (c) => {
  const db = await getDb(c.env.DB);
  const [owner, ownerDid, name, description, recordUri] = await Promise.all([
    getOwnerHandle(db).catch(() => null),
    getOwner(db).catch(() => null),
    getSetting(db, "instance_name").catch(() => null),
    getSetting(db, "instance_description").catch(() => null),
    getSetting(db, "instance_record_uri").catch(() => null),
  ]);
  const config: IglooConfig = {
    ...loadConfig(c.env),
    owner,
    ownerDid,
    name: name || null,
    description: description || null,
    instanceRecordUri: recordUri,
    appview: c.env.IGLOO_APPVIEW_URL || null,
    dataDirCollection: NSID.dataDir,
  };
  return c.json(config);
});
