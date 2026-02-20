import type { VisualTheme } from "@igloo/shared";

export interface ThemeColors {
  "--bg-primary": string;
  "--bg-secondary": string;
  "--bg-hover": string;
  "--text-primary": string;
  "--text-secondary": string;
  "--text-muted": string;
  "--accent": string;
  "--accent-hover": string;
  "--border": string;
  "--icon-color": string;
  "--header-bg": string;
  "--header-border": string;
}

export interface ThemeDefinition {
  name: string;
  fonts: {
    mono: string;
    sans: string;
  };
  fontImport: string | null;
  custom: Record<string, string>;
  light: ThemeColors;
  dark: ThemeColors;
}

export const themes: Record<VisualTheme, ThemeDefinition> = {
  github: {
    name: "GitHub",
    fonts: {
      mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap",
    custom: {
      "--border-radius": "8px",
      "--border-radius-sm": "6px",
      "--entry-padding": "0.625rem 1rem",
      "--link-decoration": "none",
      "--link-hover-decoration": "underline",
    },
    light: {
      "--bg-primary": "#ffffff",
      "--bg-secondary": "#f6f8fa",
      "--bg-hover": "#f0f2f5",
      "--text-primary": "#1a1a2e",
      "--text-secondary": "#656d76",
      "--text-muted": "#a0a8b4",
      "--accent": "#2563eb",
      "--accent-hover": "#1d4ed8",
      "--border": "#d1d9e0",
      "--icon-color": "#656d76",
      "--header-bg": "#f6f8fa",
      "--header-border": "#d1d9e0",
    },
    dark: {
      "--bg-primary": "#0d1117",
      "--bg-secondary": "#161b22",
      "--bg-hover": "#1c2128",
      "--text-primary": "#e6edf3",
      "--text-secondary": "#7d8590",
      "--text-muted": "#484f58",
      "--accent": "#58a6ff",
      "--accent-hover": "#79c0ff",
      "--border": "#30363d",
      "--icon-color": "#7d8590",
      "--header-bg": "#161b22",
      "--header-border": "#30363d",
    },
  },

  apache: {
    name: "Apache",
    fonts: {
      mono: "'Courier New', Courier, monospace",
      sans: "'Courier New', Courier, monospace",
    },
    fontImport: null,
    custom: {
      "--border-radius": "0px",
      "--border-radius-sm": "0px",
      "--entry-padding": "0.25rem 0.5rem",
      "--link-decoration": "underline",
      "--link-hover-decoration": "underline",
    },
    light: {
      "--bg-primary": "#ffffff",
      "--bg-secondary": "#f5f5f5",
      "--bg-hover": "#eeeeee",
      "--text-primary": "#000000",
      "--text-secondary": "#333333",
      "--text-muted": "#666666",
      "--accent": "#0000ee",
      "--accent-hover": "#551a8b",
      "--border": "#cccccc",
      "--icon-color": "#333333",
      "--header-bg": "#f5f5f5",
      "--header-border": "#cccccc",
    },
    dark: {
      "--bg-primary": "#1a1a1a",
      "--bg-secondary": "#222222",
      "--bg-hover": "#2a2a2a",
      "--text-primary": "#d4d4d4",
      "--text-secondary": "#a0a0a0",
      "--text-muted": "#666666",
      "--accent": "#6699ff",
      "--accent-hover": "#9999ff",
      "--border": "#444444",
      "--icon-color": "#a0a0a0",
      "--header-bg": "#222222",
      "--header-border": "#444444",
    },
  },
};

export const THEME_NAMES: VisualTheme[] = ["github", "apache"];
