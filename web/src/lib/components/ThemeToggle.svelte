<script lang="ts">
  import { colorMode, toggleColorMode } from "$lib/theme";
</script>

<button
  onclick={toggleColorMode}
  class="theme-toggle"
  aria-label="Toggle theme"
  title="Toggle light/dark mode"
>
  {#if $colorMode === "dark"}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="10" cy="10" r="4" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" />
    </svg>
  {:else}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M17 12.5A7.5 7.5 0 117.5 3a5.5 5.5 0 009.5 9.5z" />
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
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

  .theme-toggle:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }

  .theme-toggle svg {
    width: 18px;
    height: 18px;
  }
</style>
