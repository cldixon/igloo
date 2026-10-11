<script lang="ts">
  import { onMount } from "svelte";
  import {
    DUCKDB_CDN,
    QUERY_PANEL_CSS,
    loadDuckDB,
    mountQueryPanel,
    queryFiles,
  } from "@igloo/query";

  /** A data dir's files, by path relative to the data dir. */
  let { slug, files }: { slug: string; files: { path: string; format: string | null }[] } =
    $props();

  let root: HTMLDivElement;

  onMount(() => {
    const style = document.createElement("style");
    style.textContent = QUERY_PANEL_CSS;
    document.head.append(style);
    const download = (path: string) =>
      `${location.origin}/api/download?path=${encodeURIComponent(`${slug}/${path}`)}`;
    mountQueryPanel(root, { files: queryFiles(files, download), duckdb: DUCKDB_CDN }, loadDuckDB);
    return () => style.remove();
  });
</script>

<section class="query" aria-label="Query this data dir">
  <h2>Query</h2>
  <div bind:this={root}></div>
</section>

<style>
  .query {
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    padding: 1rem 1.25rem;
    display: grid;
    gap: 0.75rem;
    --mono: var(--font-mono);
    --line: var(--border);
    --sunken: var(--bg-secondary);
    --surface: var(--bg-primary);
    --muted: var(--text-secondary);
  }
  h2 {
    font-size: 1rem;
    font-weight: 600;
  }
</style>
