<script lang="ts">
  import { page } from "$app/state";
  import { EmptyState, plural } from "@igloo/ui";
  import HomeTabs from "$lib/HomeTabs.svelte";
  import EntryRow from "$lib/EntryRow.svelte";

  let { data } = $props();

  const SIZES = [
    ["", "any"],
    ["s", "< 100M"],
    ["m", "100M – 1G"],
    ["l", "> 1G"],
  ] as const;

  /** This search with one parameter changed. */
  function withParam(key: string, value: string) {
    const url = new URL(page.url);
    url.searchParams.set(key, value);
    return `${url.pathname}${url.search}`;
  }

  let filtered = $derived(
    data.facets.formats.length + data.facets.licenses.length + (data.facets.size ? 1 : 0) > 0,
  );
</script>

<svelte:head><title>{data.q ? `${data.q} · search` : "Search"} · igloo</title></svelte:head>

<div class="grid gap-6">
  <HomeTabs current="search" q={data.q} />

  {#if !data.q}
    <div class="grid max-w-reading gap-2 text-meta">
      <p>
        Words match names, titles, descriptions, file names and column names. Everything must match.
      </p>
      <ul class="grid gap-1 data">
        <li>
          <a href="/search?q=col%3Alat%20col%3Alon">col:lat col:lon</a>
          <span class="font-sans text-muted">— has these columns</span>
        </li>
        <li>
          <a href="/search?q=type%3ADATE">type:DATE</a>
          <span class="font-sans text-muted">— has a column of this type</span>
        </li>
        <li>
          <a href="/search?q=tag%3Aclimate">tag:climate</a>
          <span class="font-sans text-muted">— tagged</span>
        </li>
      </ul>
    </div>
  {:else}
    <div class="grid gap-6 md:grid-cols-[11rem_minmax(0,1fr)]">
      <form method="get" class="grid content-start gap-5 text-meta" aria-label="Filter results">
        <input type="hidden" name="q" value={data.q} />
        <input type="hidden" name="sort" value={data.sort} />
        <fieldset class="grid gap-1">
          <legend class="mb-1 font-semibold">Type</legend>
          <label class="check"
            ><input type="checkbox" checked disabled /> data dirs ({data.total})</label
          >
          {#each ["files", "columns", "instances", "people"] as t (t)}
            <label class="check text-muted" title="Later"
              ><input type="checkbox" disabled /> {t}</label
            >
          {/each}
        </fieldset>
        {#if data.formats.length > 0}
          <fieldset class="grid gap-1">
            <legend class="mb-1 font-semibold">Format</legend>
            {#each data.formats as f (f.value)}
              <label class="check"
                ><input
                  type="checkbox"
                  name="format"
                  value={f.value}
                  checked={data.facets.formats.includes(f.value)}
                />
                {f.value} <span class="text-muted">({f.count})</span></label
              >
            {/each}
          </fieldset>
        {/if}
        {#if data.licenses.length > 0}
          <fieldset class="grid gap-1">
            <legend class="mb-1 font-semibold">License</legend>
            {#each data.licenses as l (l.value)}
              <label class="check"
                ><input
                  type="checkbox"
                  name="license"
                  value={l.value}
                  checked={data.facets.licenses.includes(l.value)}
                />
                <span class="break-all">{l.value}</span>
                <span class="text-muted">({l.count})</span></label
              >
            {/each}
          </fieldset>
        {/if}
        <fieldset class="grid gap-1">
          <legend class="mb-1 font-semibold">Size</legend>
          {#each SIZES as [value, label] (value)}
            <label class="check"
              ><input type="radio" name="size" {value} checked={data.facets.size === value} />
              {label}</label
            >
          {/each}
        </fieldset>
        <fieldset class="grid gap-1">
          <legend class="mb-1 font-semibold">Status</legend>
          <label class="check text-muted" title="Arrives with liveness checks"
            ><input type="checkbox" disabled /> instance online</label
          >
        </fieldset>
        <div class="flex gap-3">
          <button type="submit" class="border border-line px-2 py-0.5">Apply</button>
          {#if filtered}<a href="/search?q={encodeURIComponent(data.q)}">clear</a>{/if}
        </div>
      </form>

      <section aria-label="Results" class="grid content-start gap-2">
        <p class="text-meta text-muted">
          {plural(data.results.length, "result")}{#if filtered}{` of ${data.total}`}{/if} · sort:
          {#if data.sort === "newest"}<span class="font-semibold text-fg">newest</span>{:else}<a
              href={withParam("sort", "newest")}>newest</a
            >{/if}
          ·
          {#if data.sort === "size"}<span class="font-semibold text-fg">size</span>{:else}<a
              href={withParam("sort", "size")}>size</a
            >{/if}
        </p>
        {#if data.results.length === 0}
          <EmptyState title="No data dirs match">
            Try fewer words, or a column name with <code class="data">col:</code>.
          </EmptyState>
        {:else}
          <div>
            {#each data.results as entry (entry.href)}<EntryRow {entry} />{/each}
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>
