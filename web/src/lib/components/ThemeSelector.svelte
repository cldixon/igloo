<script lang="ts">
  import { visualTheme, setVisualTheme } from "$lib/theme";
  import { themes, THEME_NAMES } from "$lib/themes";
  import type { VisualTheme } from "@igloo/shared";

  function handleChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as VisualTheme;
    setVisualTheme(value);
  }
</script>

<select
  class="theme-selector"
  value={$visualTheme}
  onchange={handleChange}
  aria-label="Select visual theme"
>
  {#each THEME_NAMES as t}
    <option value={t}>{themes[t].name}</option>
  {/each}
</select>

<style>
  .theme-selector {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--border-radius-sm);
    padding: 4px 8px;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .theme-selector:hover {
    border-color: var(--text-secondary);
  }

  .theme-selector:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
