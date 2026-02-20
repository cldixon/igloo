<script lang="ts">
  import "../app.css";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { theme } from "$lib/theme";

  let { children } = $props();

  // Ensure theme is applied on mount
  $effect(() => {
    document.documentElement.setAttribute("data-theme", $theme);
  });
</script>

<svelte:head>
  <title>igloo</title>
  <meta name="description" content="Personal data repository" />
</svelte:head>

<div class="app">
  <header>
    <div class="header-content">
      <a href="/" class="logo">
        <span class="logo-icon">&#10052;</span>
        <span class="logo-text">igloo</span>
      </a>
      <ThemeToggle />
    </div>
  </header>

  <main>
    {@render children()}
  </main>

  <footer>
    <span class="footer-text">igloo &mdash; personal data repository</span>
  </footer>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

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

  main {
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
</style>
