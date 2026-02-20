<script lang="ts">
  let { type, extension }: { type: "file" | "directory"; extension?: string } = $props();
</script>

<span class="file-icon" aria-hidden="true">
  {#if type === "directory"}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M2 5a2 2 0 012-2h3.586a1 1 0 01.707.293L9.707 4.707A1 1 0 0010.414 5H16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
    </svg>
  {:else if extension === "parquet"}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M3 4h14M3 8h14M3 12h14M3 16h14" />
      <path d="M7 3v14M13 3v14" />
    </svg>
  {:else if extension === "csv"}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M3 4h14M3 8h14M3 12h14M3 16h14" />
      <path d="M10 3v14" />
    </svg>
  {:else if extension === "md" || extension === "txt"}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M4 2h8l4 4v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z" />
      <path d="M5 10h10M5 13h7" />
    </svg>
  {:else if extension === "json" || extension === "yaml" || extension === "yml"}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M6 3C4.5 3 4 4.5 4 5.5S4.5 7 5 7.5C4 8 4 9 4 10s0 2 1 2.5C4.5 13 4 14.5 4 15.5S4.5 17 6 17" />
      <path d="M14 3c1.5 0 2 1.5 2 2.5S15.5 7 15 7.5c1 .5 1 1.5 1 2.5s0 2-1 2.5c.5.5 1 2 1 3S15.5 17 14 17" />
      <circle cx="8" cy="10" r="0.75" fill="currentColor" />
      <circle cx="12" cy="10" r="0.75" fill="currentColor" />
    </svg>
  {:else}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M4 2h8l4 4v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z" />
      <path d="M12 2v4h4" />
    </svg>
  {/if}
</span>

<style>
  .file-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: var(--icon-color);
  }

  .file-icon svg {
    width: 100%;
    height: 100%;
  }
</style>
