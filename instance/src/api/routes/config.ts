import { Hono } from "hono";
import type { Bindings } from "../bindings.js";
import type { IglooConfig, VisualTheme } from "../../shared/types.js";
import { getDb } from "../../db/migrations.js";
import { getOwnerHandle } from "../../auth/owner.js";

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

configRoute.get("/config", async (c) => {
  const owner = await getOwnerHandle(await getDb(c.env.DB)).catch(() => null);
  return c.json({ ...loadConfig(c.env), owner });
});
