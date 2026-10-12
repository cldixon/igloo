<script lang="ts">
  import { page } from "$app/state";
  import { DataDirView, hostOf } from "@igloo/ui";
  import { searchPath } from "$server/paths.js";

  let { data } = $props();

  let d = $derived(data.dataDir);
  let tab = $derived(page.url.searchParams.get("tab") ?? "files");
  const tabHref = (t: string) =>
    t === "files" ? page.url.pathname : `${page.url.pathname}?tab=${t}`;
  let host = $derived(hostOf(data.instanceUrl));
</script>

<svelte:head>
  <title>{d.title ?? d.name} · igloo</title>
  <meta property="og:title" content={d.title ?? d.name} />
  {#if d.description}
    <meta name="description" content={d.description} />
    <meta property="og:description" content={d.description} />
  {/if}
</svelte:head>

<DataDirView
  dataDir={d}
  {tab}
  {tabHref}
  breadcrumb={[{ label: host, href: d.instance.href }, { label: d.name }]}
  elsewhere={{ label: `open on ${host}`, href: `${data.instanceUrl}/${d.name}` }}
  tagHref={(t) => searchPath(`tag:${t}`)}
  columnHref={(c) => searchPath(`col:${c}`)}
/>
