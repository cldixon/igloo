<script lang="ts">
  import "../app.css";
  import SettingsMenu from "$lib/components/SettingsMenu.svelte";
  import { colorMode, config, applyConfig } from "$lib/theme";
  import { fetchConfig } from "$lib/api";
  import { onMount } from "svelte";

  let { children } = $props();

  onMount(async () => {
    const cfg = await fetchConfig();
    applyConfig(cfg);
  });

  $effect(() => {
    document.documentElement.setAttribute("data-theme", $colorMode);
  });
</script>

<svelte:head>
  <title>{$config.title}</title>
  <meta name="description" content={$config.tagline} />
</svelte:head>

<div class="app">
  <header>
    <div class="header-content">
      <a href="/" class="logo">
        <span class="logo-icon">&#10052;</span>
        <span class="logo-text">{$config.title}</span>
      </a>
      <SettingsMenu />
    </div>
  </header>

  <main>
    {@render children()}
  </main>

  <footer>
    <span class="footer-text">{$config.title} &mdash; {$config.tagline}</span>
  </footer>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    background-color: var(--nav-bg);
    border-bottom: 1px solid var(--nav-border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-content {
    max-width: 960px;
    margin: 0 auto;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: var(--nav-text);
  }

  .logo-icon {
    font-size: 1.25rem;
  }

  .logo-text {
    font-family: var(--nav-font);
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  main {
    flex: 1;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
    padding: 1.5rem;
  }

  footer {
    border-top: 1px solid var(--nav-border);
    background-color: var(--nav-bg);
    padding: 1rem 1.5rem;
    text-align: center;
  }

  .footer-text {
    font-family: var(--nav-font);
    font-size: 0.75rem;
    color: var(--nav-text-secondary);
  }
</style>
