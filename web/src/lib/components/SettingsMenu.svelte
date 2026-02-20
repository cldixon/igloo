<script lang="ts">
  import { colorMode, toggleColorMode, visualTheme, setVisualTheme } from "$lib/theme";
  import { themes, THEME_NAMES } from "$lib/themes";
  import type { VisualTheme } from "@igloo/shared";

  let open = $state(false);

  function toggle() {
    open = !open;
  }

  function handleThemeChange(e: Event) {
    setVisualTheme((e.target as HTMLSelectElement).value as VisualTheme);
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".settings")) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="settings">
  <button
    class="settings-btn"
    onclick={toggle}
    aria-label="Settings"
    title="Settings"
    aria-expanded={open}
  >
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="10" cy="10" r="2" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.87 3.87l1.41 1.41M14.72 14.72l1.41 1.41M3.87 16.13l1.41-1.41M14.72 5.28l1.41-1.41" />
    </svg>
  </button>

  {#if open}
    <div class="dropdown">
      <div class="setting-row">
        <label class="setting-label">Theme</label>
        <select
          class="setting-select"
          value={$visualTheme}
          onchange={handleThemeChange}
        >
          {#each THEME_NAMES as t}
            <option value={t}>{themes[t].name}</option>
          {/each}
        </select>
      </div>

      <div class="setting-row">
        <label class="setting-label">Mode</label>
        <button class="mode-toggle" onclick={toggleColorMode}>
          {#if $colorMode === "dark"}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
              <circle cx="10" cy="10" r="4" />
              <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" />
            </svg>
            <span>Light</span>
          {:else}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
              <path d="M17 12.5A7.5 7.5 0 117.5 3a5.5 5.5 0 009.5 9.5z" />
            </svg>
            <span>Dark</span>
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings {
    position: relative;
  }

  .settings-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--border-radius-sm);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, border-color 0.2s;
  }

  .settings-btn:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }

  .settings-btn svg {
    width: 18px;
    height: 18px;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 100;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--border-radius-sm);
    padding: 0.5rem;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .setting-label {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .setting-select {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--border-radius-sm);
    padding: 3px 6px;
    cursor: pointer;
  }

  .setting-select:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .mode-toggle {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--border-radius-sm);
    color: var(--text-primary);
    cursor: pointer;
    padding: 3px 8px;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    transition: border-color 0.2s;
  }

  .mode-toggle:hover {
    border-color: var(--text-secondary);
  }
</style>
