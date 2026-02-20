<script lang="ts">
  import "../app.css";
  import SettingsMenu from "$lib/components/SettingsMenu.svelte";
  import { colorMode, visualTheme, config, applyConfig } from "$lib/theme";
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

<div class="app" data-layout={$visualTheme}>
  {#if $visualTheme === "apache"}
    <!-- Apache: floating settings button, no branded header -->
    <div class="toolbar">
      <SettingsMenu />
    </div>

    <main class="apache-main">
      {@render children()}
    </main>
  {:else}
    <!-- GitHub: branded header with logo -->
    <header>
      <div class="header-content">
        <a href="/" class="logo">
          <span class="logo-icon">&#10052;</span>
          <span class="logo-text">{$config.title}</span>
        </a>
        <SettingsMenu />
      </div>
    </header>

    <main class="github-main">
      {@render children()}
    </main>

    <footer>
      <span class="footer-text">{$config.title} &mdash; {$config.tagline}</span>
    </footer>
  {/if}
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* --- GitHub layout --- */
  header {
    background-color: var(--header-bg);
    border-bottom: 1px solid var(--header-border);
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
    color: var(--text-primary);
  }

  .logo-icon {
    font-size: 1.25rem;
  }

  .logo-text {
    font-family: var(--font-mono);
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .github-main {
    flex: 1;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
    padding: 1.5rem;
  }

  footer {
    border-top: 1px solid var(--border);
    padding: 1rem 1.5rem;
    text-align: center;
  }

  .footer-text {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* --- Apache layout --- */
  .toolbar {
    position: fixed;
    top: 0.75rem;
    right: 1rem;
    z-index: 10;
  }

  .apache-main {
    flex: 1;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
    padding: 1.5rem;
    padding-top: 0.75rem;
  }
</style>
