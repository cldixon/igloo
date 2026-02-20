import { writable, derived } from "svelte/store";
import { browser } from "$app/environment";
import type { VisualTheme, ColorMode, IglooConfig } from "@igloo/shared";
import { themes } from "./themes";

// ---- Config store (populated by layout on mount) ----
export const config = writable<IglooConfig>({
  title: "igloo",
  tagline: "personal data repository",
  theme: "repo",
});

// ---- Color mode (light/dark) ----
function getInitialColorMode(): ColorMode {
  if (!browser) return "dark";
  const stored = localStorage.getItem("igloo-color-mode");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const colorMode = writable<ColorMode>(getInitialColorMode());

// ---- Visual theme ----
function getInitialVisualTheme(): VisualTheme {
  if (!browser) return "repo";
  const stored = localStorage.getItem("igloo-visual-theme");
  if (stored === "repo" || stored === "index") return stored;
  return "repo";
}

export const visualTheme = writable<VisualTheme>(getInitialVisualTheme());

// ---- Actions ----
export function toggleColorMode() {
  colorMode.update((m) => (m === "dark" ? "light" : "dark"));
}

export function setVisualTheme(t: VisualTheme) {
  visualTheme.set(t);
}

export function applyConfig(cfg: IglooConfig) {
  config.set(cfg);
  if (browser && !localStorage.getItem("igloo-visual-theme")) {
    visualTheme.set(cfg.theme);
  }
}

// ---- Side effects ----
if (browser) {
  colorMode.subscribe((value) => {
    document.documentElement.setAttribute("data-theme", value);
    localStorage.setItem("igloo-color-mode", value);
  });

  visualTheme.subscribe((value) => {
    document.documentElement.setAttribute("data-visual-theme", value);
    localStorage.setItem("igloo-visual-theme", value);
  });

  // Nav bar colors — fixed per light/dark mode, independent of visual theme
  const NAV_COLORS: Record<ColorMode, Record<string, string>> = {
    light: {
      "--nav-bg": "#f6f8fa",
      "--nav-border": "#d1d9e0",
      "--nav-text": "#1a1a2e",
      "--nav-text-secondary": "#656d76",
    },
    dark: {
      "--nav-bg": "#161b22",
      "--nav-border": "#30363d",
      "--nav-text": "#e6edf3",
      "--nav-text-secondary": "#7d8590",
    },
  };

  // Apply CSS variables and font whenever theme or color mode changes
  derived([visualTheme, colorMode], ([$vt, $cm]) => ({ vt: $vt, cm: $cm }))
    .subscribe(({ vt, cm }) => {
      const def = themes[vt];
      const colors = def[cm];
      const root = document.documentElement;

      for (const [key, val] of Object.entries(colors)) {
        root.style.setProperty(key, val);
      }

      // Nav variables — only change with light/dark, not visual theme
      for (const [key, val] of Object.entries(NAV_COLORS[cm])) {
        root.style.setProperty(key, val);
      }

      root.style.setProperty("--font-mono", def.fonts.mono);
      root.style.setProperty("--font-sans", def.fonts.sans);

      for (const [key, val] of Object.entries(def.custom)) {
        root.style.setProperty(key, val);
      }

      // Manage font import link element
      const existingLink = document.getElementById("igloo-theme-font");
      if (def.fontImport) {
        if (existingLink) {
          (existingLink as HTMLLinkElement).href = def.fontImport;
        } else {
          const link = document.createElement("link");
          link.id = "igloo-theme-font";
          link.rel = "stylesheet";
          link.href = def.fontImport;
          document.head.appendChild(link);
        }
      } else if (existingLink) {
        existingLink.remove();
      }
    });
}
