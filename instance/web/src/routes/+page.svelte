<script lang="ts">
  import { page } from "$app/state";
  import {
    Button,
    ClassicIndex,
    DataDirTable,
    EmptyState,
    PageHeader,
    PersonLink,
    formatBytes,
    plural,
  } from "@igloo/ui";
  import { appviewUrl, instanceName } from "$lib/api";

  let { data } = $props();

  let name = $derived(instanceName(data.config));
  // "index" was iteration 2's name for the plain listing; it is the default view now.
  let classic = $derived(
    (page.url.searchParams.get("view") ??
      (data.config.theme === "index" ? "classic" : "pretty")) === "classic",
  );
  let filter = $state("");
  let total = $derived(
    data.dataDirs.reduce((sum, d) => sum + d.files.reduce((s, f) => s + f.size, 0), 0),
  );
  let rows = $derived(
    data.dataDirs.map((d) => ({
      name: d.name,
      href: `/${d.name}`,
      title: d.title,
      description: d.description,
      files: d.files.length,
      size: d.files.reduce((s, f) => s + f.size, 0),
      license: d.license,
      updated: d.publishedAt,
      status: "live" as const,
    })),
  );
  const view = (v: "pretty" | "classic") => {
    const url = new URL(page.url);
    url.searchParams.set("view", v);
    return `${url.pathname}${url.search}`;
  };
</script>

<svelte:head><title>{classic ? `Index of / · ${name}` : name}</title></svelte:head>

{#if classic}
  <ClassicIndex
    title="Index of /"
    entries={rows.map((r) => ({
      name: `${r.name}/`,
      href: r.href,
      modified: r.updated ?? null,
      size: r.size,
      note: r.license,
    }))}
  >
    {#snippet footer()}<a href={view("pretty")} class="data">pretty view</a>{/snippet}
  </ClassicIndex>
{:else}
  <div class="grid gap-6">
    <PageHeader title={name} description={data.config.description ?? data.config.tagline}>
      {#snippet meta()}
        {#if data.config.ownerDid}
          Maintained by <PersonLink
            avatar={false}
            person={{
              did: data.config.ownerDid,
              handle: data.config.owner ?? null,
              href: appviewUrl(data.config, `/m/${data.config.ownerDid}`),
            }}
          />
          ·
        {/if}
        <span class="data">{plural(data.dataDirs.length, "data dir")} · {formatBytes(total)}</span>
      {/snippet}
    </PageHeader>

    {#if data.dataDirs.length === 0}
      <EmptyState title="Nothing in here yet">
        This igloo is built, but nothing has been published from it.
        {#snippet action()}
          {#if data.status?.signedIn}<Button href="/admin/new">+ New data dir</Button>{/if}
        {/snippet}
      </EmptyState>
    {:else}
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          class="input max-w-60"
          type="search"
          bind:value={filter}
          placeholder="filter {plural(data.dataDirs.length, 'data dir')}…"
          aria-label="Filter data dirs"
        />
        <span class="ml-auto data"
          ><span class="font-semibold">pretty</span> · <a href={view("classic")}>classic</a></span
        >
      </div>
      <DataDirTable {rows} {filter} />
    {/if}
  </div>
{/if}
