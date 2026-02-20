<script lang="ts">
  import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
  import DirectoryEntry from "$lib/components/DirectoryEntry.svelte";
  import ReadmeViewer from "$lib/components/ReadmeViewer.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.currentPath ? data.currentPath.replace(/\/$/, "").split("/").pop() + " — igloo" : "igloo"}</title>
</svelte:head>

<div class="browser">
  <Breadcrumbs path={data.currentPath} />

  <div class="listing">
    <div class="listing-header">
      <span class="col-name">Name</span>
      <span class="col-size">Size</span>
      <span class="col-date">Modified</span>
      <span class="col-action"></span>
    </div>

    {#if data.listing.entries.length === 0}
      <div class="empty">
        <p>This directory is empty.</p>
      </div>
    {:else}
      {#each data.listing.entries as entry (entry.path)}
        <DirectoryEntry {entry} />
      {/each}
    {/if}
  </div>

  {#if data.listing.readme}
    <ReadmeViewer content={data.listing.readme} />
  {/if}
</div>

<style>
  .browser {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .listing {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .listing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 1rem;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .col-name {
    flex: 1;
    padding-left: 2.75rem;
  }

  .col-size {
    width: 5rem;
    text-align: right;
  }

  .col-date {
    width: 10rem;
    text-align: right;
  }

  .col-action {
    width: 24px;
    margin-left: 1.5rem;
  }

  .empty {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }

  @media (max-width: 640px) {
    .listing-header {
      display: none;
    }
  }
</style>
