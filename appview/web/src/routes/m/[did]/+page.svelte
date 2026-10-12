<script lang="ts">
  import { Avatar, DataDirTable, EmptyState, Section, hostOf } from "@igloo/ui";

  let { data } = $props();
  let p = $derived(data.person);
  let name = $derived(p.displayName || (p.handle ? `@${p.handle}` : p.did));
</script>

<svelte:head><title>{name} · igloo</title></svelte:head>

<div class="grid gap-8">
  <header class="flex flex-wrap items-center gap-4">
    <Avatar src={p.avatar} size={64} />
    <div class="grid min-w-0 gap-1">
      <span class="eyebrow">Maintainer</span>
      <h1 class="text-page font-semibold break-words">{name}</h1>
      <p class="text-meta text-muted">
        {#if p.handle}@{p.handle} ·
        {/if}<code class="data break-all">{p.did}</code>
      </p>
      <p class="flex flex-wrap gap-x-3 text-meta">
        {#if p.handle}<a href="https://bsky.app/profile/{p.handle}">Bluesky ↗</a>{/if}
        <a href="https://pdsls.dev/at://{p.did}">pdsls ↗</a>
        {#if p.pds}<span class="data text-muted">PDS: {hostOf(p.pds)}</span>{/if}
      </p>
    </div>
  </header>
  {#if p.description}<p class="max-w-reading whitespace-pre-line">{p.description}</p>{/if}

  <Section title="Instances">
    {#if data.instances.length === 0}
      <p class="text-meta text-muted">No instance records.</p>
    {:else}
      <ul class="grid gap-3">
        {#each data.instances as i (i.href)}
          <li class="grid gap-0.5">
            <span
              ><a href={i.href} class="font-semibold">{i.name}</a>
              <span class="data text-muted">{hostOf(i.url)}</span></span
            >
            {#if i.description}<span class="text-meta text-muted">{i.description}</span>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Section>

  <Section title="Data dirs">
    {#if data.dataDirs.length === 0}
      <EmptyState title="Nothing published yet" />
    {:else}
      <DataDirTable rows={data.dataDirs} />
    {/if}
  </Section>
</div>
