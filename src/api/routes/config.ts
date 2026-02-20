import { Hono } from "hono";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import type { IglooConfig, VisualTheme } from "../../shared/types.js";

export const configRoute = new Hono();

const VALID_THEMES: VisualTheme[] = ["repo", "index"];

const DEFAULTS: IglooConfig = {
  title: "igloo",
  tagline: "personal data repository",
  theme: "repo",
};

function loadConfig(): IglooConfig {
  try {
    const configPath = process.env.IGLOO_CONFIG_PATH
      ? resolve(process.env.IGLOO_CONFIG_PATH)
      : resolve(process.cwd(), "igloo.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const parsed = yaml.load(raw) as Record<string, unknown>;

    return {
      title: typeof parsed.title === "string" ? parsed.title : DEFAULTS.title,
      tagline:
        typeof parsed.tagline === "string"
          ? parsed.tagline
          : DEFAULTS.tagline,
      theme: VALID_THEMES.includes(parsed.theme as VisualTheme)
        ? (parsed.theme as VisualTheme)
        : DEFAULTS.theme,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

configRoute.get("/config", (c) => {
  const config = loadConfig();
  return c.json(config);
});
