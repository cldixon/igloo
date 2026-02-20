<script lang="ts">
  import type { DirectoryListing } from "@igloo/shared";
  import ReadmeViewer from "$lib/components/ReadmeViewer.svelte";
  import { formatBytes, formatDate } from "$lib/utils";
  import { getDownloadUrl } from "$lib/api";
  import { config } from "$lib/theme";

  let { listing, currentPath }: { listing: DirectoryListing; currentPath: string } = $props();

  let indexPath = $derived(currentPath ? `/${currentPath.replace(/\/$/, "")}` : "/");

  let parentPath = $derived(() => {
    if (!currentPath) return null;
    const segments = currentPath.replace(/\/$/, "").split("/");
    segments.pop();
    return segments.length > 0 ? `/${segments.join("/")}` : "/";
  });
</script>

<div class="apache-listing">
  <h1>Index of {indexPath}</h1>

  <hr />

  <table>
    <thead>
      <tr>
        <th class="col-icon"></th>
        <th class="col-name">Name</th>
        <th class="col-date">Last modified</th>
        <th class="col-size">Size</th>
      </tr>
    </thead>
    <tbody>
      <tr class="header-rule">
        <td colspan="4"><hr /></td>
      </tr>

      {#if parentPath()}
        <tr class="entry">
          <td class="col-icon">[DIR]</td>
          <td class="col-name"><a href={parentPath()}>Parent Directory</a></td>
          <td class="col-date">-</td>
          <td class="col-size">-</td>
        </tr>
      {/if}

      {#if listing.entries.length === 0 && !parentPath()}
        <tr>
          <td colspan="4" class="empty">This directory is empty.</td>
        </tr>
      {:else}
        {#each listing.entries as entry (entry.path)}
          <tr class="entry">
            <td class="col-icon">{entry.type === "directory" ? "[DIR]" : "[   ]"}</td>
            <td class="col-name">
              {#if entry.type === "directory"}
                <a href="/{entry.path.replace(/\/$/, '')}">{entry.name}/</a>
              {:else}
                <a href={getDownloadUrl(entry.path)}>{entry.name}</a>
              {/if}
            </td>
            <td class="col-date">{entry.lastModified ? formatDate(entry.lastModified) : "-"}</td>
            <td class="col-size">{entry.type === "file" && entry.size != null ? formatBytes(entry.size) : "-"}</td>
          </tr>
        {/each}
      {/if}

      <tr class="footer-rule">
        <td colspan="4"><hr /></td>
      </tr>
    </tbody>
  </table>

  <address>{$config.title} Server</address>

  {#if listing.readme}
    <ReadmeViewer content={listing.readme} />
  {/if}
</div>

<style>
  .apache-listing {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  h1 {
    font-family: var(--font-mono);
    font-size: 1.25rem;
    font-weight: normal;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
  }

  thead th {
    text-align: left;
    font-weight: bold;
    color: var(--text-primary);
    padding: 0.25rem 0.75rem;
  }

  .col-icon {
    width: 3.5rem;
    padding: 0.125rem 0.5rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  td.col-name {
    padding: 0.125rem 0.75rem;
  }

  th.col-name {
    /* no extra needed */
  }

  td.col-date,
  th.col-date {
    padding: 0.125rem 0.75rem;
    white-space: nowrap;
    color: var(--text-secondary);
  }

  td.col-size,
  th.col-size {
    padding: 0.125rem 0.75rem;
    text-align: right;
    white-space: nowrap;
    color: var(--text-secondary);
  }

  .entry td {
    padding-top: 0.125rem;
    padding-bottom: 0.125rem;
  }

  .entry:hover {
    background-color: var(--bg-hover);
  }

  td a {
    color: var(--accent);
    text-decoration: underline;
  }

  td a:hover {
    color: var(--accent-hover);
  }

  .header-rule td,
  .footer-rule td {
    padding: 0.25rem 0;
  }

  .header-rule hr,
  .footer-rule hr {
    border-top: 1px solid var(--border);
  }

  .empty {
    padding: 1.5rem 0.75rem;
    color: var(--text-muted);
  }

  address {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-style: italic;
    color: var(--text-muted);
    margin-top: 0.5rem;
  }

  @media (max-width: 640px) {
    .col-date {
      display: none;
    }

    th.col-date {
      display: none;
    }
  }
</style>
