<script lang="ts">
  import { buildBreadcrumbs } from "$lib/utils";

  let { path }: { path: string } = $props();

  let crumbs = $derived(buildBreadcrumbs(path));
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  {#each crumbs as crumb, i}
    {#if i > 0}
      <span class="separator">/</span>
    {/if}
    {#if i === crumbs.length - 1}
      <span class="current">{crumb.name}</span>
    {:else}
      <a href="/{crumb.path.replace(/\/$/, '')}">{crumb.name}</a>
    {/if}
  {/each}
</nav>

<style>
  .breadcrumbs {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .separator {
    color: var(--text-muted);
  }

  a {
    color: var(--accent);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  .current {
    color: var(--text-primary);
  }
</style>
