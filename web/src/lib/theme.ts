import { writable } from "svelte/store";
import { browser } from "$app/environment";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (!browser) return "dark";
  const stored = localStorage.getItem("igloo-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const theme = writable<Theme>(getInitialTheme());

if (browser) {
  theme.subscribe((value) => {
    document.documentElement.setAttribute("data-theme", value);
    localStorage.setItem("igloo-theme", value);
  });
}

export function toggleTheme() {
  theme.update((t) => (t === "dark" ? "light" : "dark"));
}
