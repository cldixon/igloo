<script lang="ts">
  import { ActivityRow, formatBytes, plural } from "@igloo/ui";
  import type { Entry } from "$server/pages.js";

  /** A data dir in the feed or in search results. */
  let { entry, verb = "published" }: { entry: Entry; verb?: string } = $props();
</script>

<ActivityRow
  actor={entry.actor}
  {verb}
  title={entry.name}
  href={entry.href}
  instance={entry.instance}
  when={entry.createdAt}
  description={entry.title && entry.title !== entry.name
    ? `${entry.title}${entry.description ? ` — ${entry.description}` : ""}`
    : entry.description}
  meta={[
    entry.formats.join(", ") || "files",
    plural(entry.files, "file"),
    formatBytes(entry.bytes),
    entry.license ?? "no license",
  ]}
>
  {#snippet actions()}
    <a href={entry.href}>files</a>
    {#if entry.formats.length > 0}<a href="{entry.href}?tab=query">query</a>{/if}
  {/snippet}
</ActivityRow>
