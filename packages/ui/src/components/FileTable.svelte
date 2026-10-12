<script lang="ts">
  import type { Snippet } from "svelte";
  import SortHeader from "./SortHeader.svelte";
  import { formatBytes, formatDate, shortHash } from "../format.js";
  import type { DataFile } from "../types.js";

  /**
   * A data dir's files: path, size, format, rows, sha256. Monospace with
   * aligned numbers; paths wrap, sizes and hashes never do. Sorts by name,
   * size or date, as the old listings did.
   */
  let {
    files,
    columns = ["size", "format", "sha256"],
    actions,
    caption,
  }: {
    files: DataFile[];
    columns?: ("size" | "format" | "rows" | "modified" | "sha256")[];
    actions?: Snippet<[DataFile]>;
    caption?: string;
  } = $props();

  type Key = "path" | "size" | "modified" | "rows";
  let sort = $state<Key>("path");
  let descending = $state(false);

  function by(key: Key) {
    descending = sort === key ? !descending : key !== "path";
    sort = key;
  }

  let sorted = $derived(
    [...files].sort((a, b) => {
      const order =
        sort === "path"
          ? a.path.localeCompare(b.path)
          : sort === "size"
            ? a.size - b.size
            : sort === "rows"
              ? (a.rows ?? -1) - (b.rows ?? -1)
              : (a.modified ?? "").localeCompare(b.modified ?? "");
      return descending ? -order : order;
    }),
  );

  const has = (c: (typeof columns)[number]) => columns.includes(c);
</script>

<div class="table-scroll">
  <table class="table data-table">
    {#if caption}<caption class="sr-only">{caption}</caption>{/if}
    <thead>
      <tr>
        <SortHeader label="file" active={sort === "path"} {descending} onclick={() => by("path")} />
        {#if has("modified")}
          <SortHeader
            label="modified"
            active={sort === "modified"}
            {descending}
            onclick={() => by("modified")}
          />
        {/if}
        {#if has("size")}
          <SortHeader
            label="size"
            numeric
            active={sort === "size"}
            {descending}
            onclick={() => by("size")}
          />
        {/if}
        {#if has("rows")}
          <SortHeader
            label="rows"
            numeric
            active={sort === "rows"}
            {descending}
            onclick={() => by("rows")}
          />
        {/if}
        {#if has("format")}<th scope="col">type</th>{/if}
        {#if has("sha256")}<th scope="col">sha256</th>{/if}
        {#if actions}<th scope="col"><span class="sr-only">Actions</span></th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each sorted as f (f.path)}
        <tr>
          <td class="min-w-40 break-all">
            {#if f.url}<a href={f.url}>{f.path}</a>{:else}{f.path}{/if}
          </td>
          {#if has("modified")}<td class="nowrap">{formatDate(f.modified)}</td>{/if}
          {#if has("size")}<td class="num">{formatBytes(f.size)}</td>{/if}
          {#if has("rows")}<td class="num"
              >{f.rows != null ? f.rows.toLocaleString("en-US") : "-"}</td
            >{/if}
          {#if has("format")}<td class="nowrap">{f.format ?? "-"}</td>{/if}
          {#if has("sha256")}<td class="nowrap" title={f.sha256}
              >{f.sha256 ? shortHash(f.sha256) : "-"}</td
            >{/if}
          {#if actions}<td class="num">{@render actions(f)}</td>{/if}
        </tr>
      {:else}
        <tr><td colspan="7" class="text-muted">No files.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
