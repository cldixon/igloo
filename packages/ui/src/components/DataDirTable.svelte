<script lang="ts">
  import SortHeader from "./SortHeader.svelte";
  import StatusMark from "./StatusMark.svelte";
  import { formatBytes, formatDate } from "../format.js";
  import type { Status } from "../types.js";

  /**
   * A listing of data dirs: an instance's public index, an instance page on
   * the AppView. Name, description, files, size, license, updated.
   */
  type Row = {
    name: string;
    href: string;
    title?: string | null;
    description?: string | null;
    files: number;
    size: number;
    license?: string | null;
    updated?: string | null;
    status?: Status;
  };
  let { rows, filter = "" }: { rows: Row[]; filter?: string } = $props();

  type Key = "name" | "size" | "updated";
  let sort = $state<Key>("updated");
  let descending = $state(true);

  function by(key: Key) {
    descending = sort === key ? !descending : key !== "name";
    sort = key;
  }

  let shown = $derived(
    rows
      .filter((r) => {
        const q = filter.trim().toLowerCase();
        return (
          !q ||
          [r.name, r.title, r.description, r.license].some((s) => s?.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const order =
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "size"
              ? a.size - b.size
              : (a.updated ?? "").localeCompare(b.updated ?? "");
        return descending ? -order : order;
      }),
  );
</script>

<div class="table-scroll">
  <table class="table">
    <thead>
      <tr>
        <SortHeader
          label="data dir"
          active={sort === "name"}
          {descending}
          onclick={() => by("name")}
        />
        <th scope="col" class="hidden md:table-cell">description</th>
        <th scope="col" class="num">files</th>
        <SortHeader
          label="size"
          numeric
          active={sort === "size"}
          {descending}
          onclick={() => by("size")}
        />
        <th scope="col" class="hidden sm:table-cell">license</th>
        <SortHeader
          label="updated"
          active={sort === "updated"}
          {descending}
          onclick={() => by("updated")}
        />
      </tr>
    </thead>
    <tbody>
      {#each shown as r (r.name)}
        <tr>
          <td class="min-w-40">
            <span class="inline-flex items-center gap-2">
              {#if r.status}<StatusMark
                  status={r.status}
                  label={r.status === "live" ? "published" : "draft"}
                  compact
                />{/if}
              <a href={r.href} class="data break-all">{r.name}/</a>
            </span>
            {#if r.title && r.title !== r.name}<div class="text-muted">{r.title}</div>{/if}
            {#if r.description}<div class="text-muted md:hidden">{r.description}</div>{/if}
          </td>
          <td class="hidden max-w-sm md:table-cell">{r.description ?? ""}</td>
          <td class="num data">{r.files}</td>
          <td class="num data">{formatBytes(r.size)}</td>
          <td class="hidden data nowrap sm:table-cell">{r.license ?? "-"}</td>
          <td class="data nowrap">{formatDate(r.updated)}</td>
        </tr>
      {:else}
        <tr
          ><td colspan="6" class="text-muted">{filter ? "Nothing matches." : "No data dirs."}</td
          ></tr
        >
      {/each}
    </tbody>
  </table>
</div>
