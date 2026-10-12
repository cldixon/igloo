<script lang="ts">
  import {
    EmptyState,
    PersonLink,
    SortHeader,
    formatBytes,
    formatDate,
    hostOf,
    plural,
  } from "@igloo/ui";

  let { data } = $props();

  let filter = $state("");
  type Key = "name" | "dirs" | "size" | "last";
  let sort = $state<Key>("last");
  let descending = $state(true);
  function by(key: Key) {
    descending = sort === key ? !descending : key !== "name";
    sort = key;
  }

  let shown = $derived(
    data.instances
      .filter((i) => {
        const q = filter.trim().toLowerCase();
        return (
          !q || [i.name, i.url, i.operator.handle ?? ""].some((s) => s.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const order =
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "dirs"
              ? a.dataDirs - b.dataDirs
              : sort === "size"
                ? a.bytes - b.bytes
                : (a.lastPublished ?? "").localeCompare(b.lastPublished ?? "");
        return descending ? -order : order;
      }),
  );
</script>

<svelte:head><title>Instances · igloo</title></svelte:head>

<div class="grid gap-6">
  <div class="grid gap-2">
    <h1 class="text-page font-semibold">Instances</h1>
    <p class="max-w-reading text-muted">
      Every igloo the network knows about. Each is one person's own server, on their own domain.
    </p>
  </div>
  {#if data.instances.length === 0}
    <EmptyState title="No instances yet">
      {#snippet action()}<a href="/deploy">Deploy the first one</a>{/snippet}
    </EmptyState>
  {:else}
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <input
        class="input max-w-60"
        type="search"
        bind:value={filter}
        placeholder="filter {plural(data.instances.length, 'instance')}…"
        aria-label="Filter instances"
      />
      <label class="check text-meta text-muted" title="Arrives with liveness checks"
        ><input type="checkbox" disabled /> online only</label
      >
    </div>
    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <SortHeader
              label="instance"
              active={sort === "name"}
              {descending}
              onclick={() => by("name")}
            />
            <th scope="col">operator</th>
            <th scope="col" class="hidden sm:table-cell">status</th>
            <SortHeader
              label="dirs"
              numeric
              active={sort === "dirs"}
              {descending}
              onclick={() => by("dirs")}
            />
            <SortHeader
              label="size"
              numeric
              active={sort === "size"}
              {descending}
              onclick={() => by("size")}
            />
            <SortHeader
              label="last publish"
              active={sort === "last"}
              {descending}
              onclick={() => by("last")}
            />
          </tr>
        </thead>
        <tbody>
          {#each shown as i (i.href)}
            <tr>
              <td>
                <a href={i.href}>{i.name}</a>
                <div class="data text-muted">{hostOf(i.url)}</div>
              </td>
              <td><PersonLink person={i.operator} avatar={false} /></td>
              <td class="hidden text-muted sm:table-cell">-</td>
              <td class="num data">{i.dataDirs}</td>
              <td class="num data">{formatBytes(i.bytes)}</td>
              <td class="data nowrap">{formatDate(i.lastPublished)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
