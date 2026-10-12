<script lang="ts">
  import type { Snippet } from "svelte";
  import { formatBytes, formatDateTime } from "../format.js";

  /**
   * The classic view: a real plain "Index of /" listing, as the old AutoIndex
   * servers printed it. Columns sort like they did (name, modified, size).
   */
  type Entry = {
    name: string;
    href: string;
    modified: string | null;
    size: number | null;
    note?: string | null;
  };
  let {
    title,
    entries,
    parent,
    footer,
  }: { title: string; entries: Entry[]; parent?: string | null; footer?: Snippet } = $props();

  type Key = "name" | "modified" | "size";
  let sort = $state<Key>("name");
  let descending = $state(false);

  function by(key: Key) {
    descending = sort === key ? !descending : false;
    sort = key;
  }

  let sorted = $derived(
    [...entries].sort((a, b) => {
      const order =
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "size"
            ? (a.size ?? -1) - (b.size ?? -1)
            : (a.modified ?? "").localeCompare(b.modified ?? "");
      return descending ? -order : order;
    }),
  );

  // Column widths, in characters.
  let nameWidth = $derived(Math.max(24, ...entries.map((e) => e.name.length + 2)));
  const MODIFIED = 18;
  const SIZE = 6;

  const columns: { key: Key; label: string; width: () => number }[] = [
    { key: "name", label: "Name", width: () => nameWidth },
    { key: "modified", label: "Last modified", width: () => MODIFIED },
    { key: "size", label: "Size", width: () => SIZE + 2 },
  ];

  let rule = $derived("-".repeat(nameWidth + MODIFIED + SIZE + 2 + 12));

  function rest(e: {
    name: string;
    modified: string | null;
    size: number | null;
    note?: string | null;
  }) {
    return (
      " ".repeat(nameWidth - e.name.length) +
      (e.modified ? formatDateTime(e.modified) : "-").padEnd(MODIFIED) +
      (e.size == null ? "-" : formatBytes(e.size)).padStart(SIZE) +
      (e.note ? `  ${e.note}` : "")
    );
  }
</script>

<div class="overflow-x-auto">
  <h2 class="mb-4 text-page font-semibold">{title}</h2>
  <pre class="data leading-relaxed">{#each columns as c (c.key)}<button
        type="button"
        class="underline underline-offset-2"
        aria-label="Sort by {c.label.toLowerCase()}"
        onclick={() => by(c.key)}>{c.label}</button
      >{" ".repeat(c.width() - c.label.length)}{/each}{"\n"}{rule}{"\n"}{#if parent != null}<a
        href={parent}>Parent Directory</a
      >{rest({
        name: "Parent Directory",
        modified: null,
        size: null,
      })}{"\n"}{/if}{#each sorted as e (e.name)}<a href={e.href}>{e.name}</a>{rest(
        e,
      )}{"\n"}{/each}{rule}</pre>
  {#if footer}<div class="mt-2">{@render footer()}</div>{/if}
</div>
