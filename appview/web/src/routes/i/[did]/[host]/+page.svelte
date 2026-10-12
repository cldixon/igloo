<script lang="ts">
  import {
    Button,
    DataDirTable,
    EmptyState,
    MetaList,
    PageHeader,
    PersonLink,
    TabNav,
    formatBytes,
    formatDate,
    hostOf,
    plural,
  } from "@igloo/ui";

  let { data } = $props();
  let i = $derived(data.instance);
  let filter = $state("");
</script>

<svelte:head>
  <title>{i.name} · igloo</title>
  {#if i.description}<meta name="description" content={i.description} />{/if}
</svelte:head>

<div class="grid gap-8">
  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
    <PageHeader title={i.name} description={i.description}>
      {#snippet crumbs()}
        <p class="data text-muted"><a href="/instances">instances</a> / {hostOf(i.url)}</p>
      {/snippet}
      {#snippet meta()}
        <span class="data"><a href={i.url}>{i.url}</a> · status: not checked yet</span>
      {/snippet}
    </PageHeader>
    <aside class="grid content-start gap-2 border border-line p-3 text-meta">
      <h2 class="eyebrow">Operated by</h2>
      <p><PersonLink person={data.operator} name /></p>
      <p class="data break-all text-muted">{data.operator.did}</p>
      {#if data.operator.pds}<p class="data text-muted">PDS: {hostOf(data.operator.pds)}</p>{/if}
      <p class="flex flex-wrap gap-x-3">
        {#if data.operator.handle}<a href="https://bsky.app/profile/{data.operator.handle}"
            >Bluesky ↗</a
          >{/if}
        <a href="https://pdsls.dev/at://{data.operator.did}">pdsls ↗</a>
      </p>
    </aside>
  </div>

  <div class="flex flex-wrap gap-2">
    <Button href={i.url}>Open instance ↗</Button>
    <Button disabled title="Follows arrive later">Follow instance</Button>
  </div>

  <MetaList
    rows={[
      { label: "Data dirs", value: `${data.dataDirs.length} published` },
      { label: "Total size", value: formatBytes(data.bytes), mono: true },
      { label: "First published", value: formatDate(data.firstPublished), mono: true },
      { label: "Last published", value: formatDate(data.lastPublished), mono: true },
      { label: "Record", value: i.uri, mono: true },
      { label: "Uptime", value: "arrives with liveness checks" },
    ]}
  />

  <div class="grid gap-4">
    <TabNav
      label="Instance"
      current="dirs"
      items={[
        { id: "dirs", label: "Data dirs", href: "", count: data.dataDirs.length },
        { id: "mirrors", label: "Mirrors hosted", href: "", disabled: true },
        { id: "activity", label: "Activity", href: "", disabled: true },
      ]}
    />
    {#if data.dataDirs.length === 0}
      <EmptyState title="Nothing published yet">This igloo hasn't published a data dir.</EmptyState>
    {:else}
      {#if data.dataDirs.length > 8}
        <input
          class="input max-w-60"
          type="search"
          bind:value={filter}
          placeholder="filter {plural(data.dataDirs.length, 'data dir')}…"
          aria-label="Filter data dirs"
        />
      {/if}
      <DataDirTable rows={data.dataDirs} {filter} />
    {/if}
  </div>
</div>
