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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  </button>

  {#if open}
    <div class="dropdown">
      <div class="setting-row">
        <label class="setting-label" for="theme-select">Theme</label>
        <select
          id="theme-select"
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
        <span class="setting-label">Mode</span>
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
    border: 1px solid var(--nav-border);
    color: var(--nav-text-secondary);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, border-color 0.2s;
  }

  .settings-btn:hover {
    color: var(--nav-text);
    border-color: var(--nav-text-secondary);
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
    background-color: var(--nav-bg);
    border: 1px solid var(--nav-border);
    border-radius: 6px;
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
    font-family: var(--nav-font);
    font-size: 0.6875rem;
    color: var(--nav-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .setting-select {
    font-family: var(--nav-font);
    font-size: 0.75rem;
    background-color: var(--nav-bg);
    color: var(--nav-text);
    border: 1px solid var(--nav-border);
    border-radius: 6px;
    padding: 3px 6px;
    cursor: pointer;
  }

  .setting-select:focus {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .mode-toggle {
    font-family: var(--nav-font);
    font-size: 0.75rem;
    background: none;
    border: 1px solid var(--nav-border);
    border-radius: 6px;
    color: var(--nav-text);
    cursor: pointer;
    padding: 3px 8px;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    transition: border-color 0.2s;
  }

  .mode-toggle:hover {
    border-color: var(--nav-text-secondary);
  }
</style>
