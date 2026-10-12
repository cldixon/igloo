<script lang="ts">
  import { onMount } from "svelte";
  import {
    DUCKDB_CDN,
    QUERY_PANEL_CSS,
    loadDuckDB,
    mountQueryPanel,
    type QueryFile,
  } from "@igloo/query";

  /**
   * In-browser SQL over a data dir's files: DuckDB-WASM reading byte ranges
   * straight from the instance. Nothing passes through an igloo server.
   */
  let { files }: { files: QueryFile[] } = $props();

  let root: HTMLDivElement;

  onMount(() => {
    const style = document.createElement("style");
    style.textContent = QUERY_PANEL_CSS;
    document.head.appendChild(style);
    mountQueryPanel(root, { files, duckdb: DUCKDB_CDN }, loadDuckDB);
    return () => style.remove();
  });
</script>

<div bind:this={root} class="query-panel"></div>
<p class="text-meta text-muted">
  Runs in your browser with DuckDB-WASM. Only the byte ranges a query needs are read from the
  instance; nothing is sent to an igloo server.
</p>
