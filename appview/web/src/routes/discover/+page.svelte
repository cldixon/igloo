<script lang="ts">
  import { EmptyState, Section, formatBytes } from "@igloo/ui";
  import HomeTabs from "$lib/HomeTabs.svelte";
  import EntryRow from "$lib/EntryRow.svelte";

  let { data } = $props();
</script>

<svelte:head><title>Discover · igloo</title></svelte:head>

<div class="grid gap-8">
  <HomeTabs current="discover" />

  {#if data.tags.length > 0}
    <p class="flex flex-wrap gap-x-3 gap-y-1">
      <span class="text-muted">by topic:</span>
      {#each data.tags as t (t.tag)}
        <a href="/search?q={encodeURIComponent(`tag:${t.tag}`)}"
          >{t.tag}<span class="data text-muted"> {t.count}</span></a
        >
      {/each}
    </p>
  {/if}

  <div class="grid gap-8 md:grid-cols-2">
    <Section title="Random data dir">
      {#if data.random}
        <EntryRow entry={data.random} />
        <a href="/discover">another →</a>
      {:else}
        <EmptyState title="Nothing published yet" />
      {/if}
    </Section>

    <Section title="Instances by size">
      {#if data.bySize.length === 0}
        <p class="text-meta text-muted">No instances yet.</p>
      {:else}
        <div class="table-scroll">
          <table class="table">
            <tbody>
              {#each data.bySize as i (i.href)}
                <tr>
                  <td><a href={i.href}>{i.name}</a></td>
                  <td class="num data">{i.dataDirs} dirs</td>
                  <td class="num data">{formatBytes(i.bytes)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Section>

    <Section title="Most mirrored">
      <p class="text-meta text-muted">Arrives with mirrors.</p>
    </Section>

    <Section title="Most queried">
      <p class="text-meta text-muted">Arrives with query counts.</p>
    </Section>
  </div>
</div>
