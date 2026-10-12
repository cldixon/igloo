<script lang="ts">
  import { page } from "$app/state";
  import { DataDirView, hostOf } from "@igloo/ui";
  import { instanceName, toModel } from "$lib/api";

  let { data } = $props();

  let model = $derived(toModel(data.dataDir, data.config));
  let tab = $derived(page.url.searchParams.get("tab") ?? "files");
  const tabHref = (t: string) => (t === "files" ? `/${data.name}` : `/${data.name}?tab=${t}`);
</script>

<svelte:head>
  <title>{data.dataDir.title ?? data.name} · {instanceName(data.config)}</title>
  {#if data.dataDir.description}<meta name="description" content={data.dataDir.description} />{/if}
</svelte:head>

<DataDirView
  dataDir={model}
  {tab}
  {tabHref}
  breadcrumb={[{ label: location.host, href: "/" }, { label: `${data.name}/` }]}
  elsewhere={data.dataDir.feedUrl && data.config.appview
    ? { label: `view on ${hostOf(data.config.appview)}`, href: data.dataDir.feedUrl }
    : null}
/>
