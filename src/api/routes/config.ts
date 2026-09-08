import { Hono } from "hono";
import type { Bindings } from "../bindings.js";
import type { IglooConfig, VisualTheme } from "../../shared/types.js";

export const configRoute = new Hono<{ Bindings: Bindings }>();

const VALID_THEMES: VisualTheme[] = ["repo", "index"];

const DEFAULTS: IglooConfig = {
  title: "igloo",
  tagline: "personal data repository",
  theme: "repo",
};

/** Instance config comes from wrangler vars — there is no filesystem on Workers. */
export function loadConfig(env: Bindings): IglooConfig {
  return {
    title: env.IGLOO_TITLE || DEFAULTS.title,
    tagline: env.IGLOO_TAGLINE || DEFAULTS.tagline,
    theme: VALID_THEMES.includes(env.IGLOO_THEME as VisualTheme)
      ? (env.IGLOO_THEME as VisualTheme)
      : DEFAULTS.theme,
  };
}

configRoute.get("/config", (c) => c.json(loadConfig(c.env)));
