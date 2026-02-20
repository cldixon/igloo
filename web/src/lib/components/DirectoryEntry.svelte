<script lang="ts">
  import type { DirectoryEntry } from "@igloo/shared";
  import FileIcon from "./FileIcon.svelte";
  import { formatBytes, formatDate, formatDateFull } from "$lib/utils";
  import { getDownloadUrl } from "$lib/api";

  let { entry }: { entry: DirectoryEntry } = $props();
</script>

<div class="entry">
  <div class="entry-name">
    <FileIcon type={entry.type} extension={entry.extension} />
    {#if entry.type === "directory"}
      <a href="/{entry.path.replace(/\/$/, '')}" class="name-link directory">{entry.name}</a>
    {:else}
      <span class="name-text">{entry.name}</span>
    {/if}
  </div>

  <div class="entry-meta">
    {#if entry.type === "file"}
      {#if entry.size != null}
        <span class="size">{formatBytes(entry.size)}</span>
      {/if}
      {#if entry.lastModified}
        <span class="date" title={formatDateFull(entry.lastModified)}>{formatDate(entry.lastModified)}</span>
      {/if}
      <a
        href={getDownloadUrl(entry.path)}
        class="download"
        title="Download {entry.name}"
        aria-label="Download {entry.name}"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
          <path d="M10 3v10M6 10l4 4 4-4M4 17h12" />
        </svg>
      </a>
    {:else}
      <span class="size"></span>
      <span class="date"></span>
      <span class="download-placeholder"></span>
    {/if}
  </div>
</div>

<style>
  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--entry-padding);
    border-bottom: 1px solid var(--border);
    transition: background-color 0.15s;
  }

  .entry:hover {
    background-color: var(--bg-hover);
  }

  .entry-name {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    flex: 1;
  }

  .name-link {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--accent);
    text-decoration: var(--link-decoration);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .name-link:hover {
    text-decoration: var(--link-hover-decoration);
  }

  .name-text {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-meta {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .size {
    width: 5rem;
    text-align: right;
  }

  .date {
    width: 7.5rem;
    text-align: right;
  }

  .download {
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    padding: 0.25rem;
    border-radius: var(--border-radius-sm);
    transition: color 0.15s;
  }

  .download:hover {
    color: var(--accent);
  }

  .download-placeholder {
    width: 24px;
  }

  @media (max-width: 640px) {
    .entry {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.375rem;
    }

    .entry-meta {
      padding-left: 2.75rem;
      gap: 1rem;
    }

    .date {
      width: auto;
    }
  }
</style>
